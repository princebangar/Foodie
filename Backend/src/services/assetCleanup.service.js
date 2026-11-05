import mongoose from 'mongoose';
import { deleteStoredAsset, resolveStoredFilename } from './storage.service.js';
import { logger } from '../utils/logger.js';

/**
 * Removes upload files that the database no longer needs.
 *
 * Call releaseStoredAssets() only after the record has been saved. A file is
 * deleted only when no record in any collection still points at it, so images
 * shared between records stay, and a client-supplied URL cannot be used to delete
 * someone else's file.
 */

/** Schema paths that can hold an upload URL. Matched against the full dotted path. */
const ASSET_PATH = /image|photo|logo|favicon|icon|banner|qr|picture|avatar|thumbnail|bill|proof|document|attachment|media|file|url/i;

/**
 * Copies of an image kept only for display. They do not keep the file alive: they
 * are pointed at the replacement image (or cleared) just before the file goes.
 */
const DISPLAY_COPIES = { FoodOrder: { array: 'items', field: 'image' } };

/** Mixed fields the schema walk cannot see. Old food images stay until admin review ends. */
const EXTRA_REFERENCES = {
    FoodItem: (filename) => [{ approvalStatus: 'pending', 'oldData.image': filename }]
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isStringPath = (type) =>
    type.instance === 'String' ||
    (type.instance === 'Array' && (type.$embeddedSchemaType?.instance || type.caster?.instance) === 'String');

const collectAssetPaths = (schema, prefix = '') => {
    const paths = [];
    schema.eachPath((name, type) => {
        const fullPath = `${prefix}${name}`;
        if (type.schema) {
            paths.push(...collectAssetPaths(type.schema, `${fullPath}.`));
        } else if (isStringPath(type) && ASSET_PATH.test(fullPath)) {
            paths.push(fullPath);
        }
    });
    return paths;
};

const assetPathCache = new Map();

const assetPathsFor = (model) => {
    if (!assetPathCache.has(model.modelName)) {
        const copy = DISPLAY_COPIES[model.modelName];
        const displayPath = copy ? `${copy.array}.${copy.field}` : null;
        assetPathCache.set(
            model.modelName,
            collectAssetPaths(model.schema).filter((path) => path !== displayPath)
        );
    }
    return assetPathCache.get(model.modelName);
};

const isReferenced = async (filename) => {
    const match = new RegExp(escapeRegex(filename));
    const results = await Promise.all(
        mongoose.modelNames().map((name) => {
            const model = mongoose.model(name);
            const clauses = [
                ...assetPathsFor(model).map((path) => ({ [path]: match })),
                ...(EXTRA_REFERENCES[name]?.(match) || [])
            ];
            if (!clauses.length) return null;
            return model.collection.findOne({ $or: clauses }, { projection: { _id: 1 } });
        })
    );
    return results.some(Boolean);
};

const updateDisplayCopies = async (filename, replacement) => {
    const match = new RegExp(escapeRegex(filename));
    await Promise.all(
        Object.entries(DISPLAY_COPIES).map(([name, { array, field }]) => {
            if (!mongoose.modelNames().includes(name)) return null;
            return mongoose.model(name).collection.updateMany(
                { [`${array}.${field}`]: match },
                { $set: { [`${array}.$[entry].${field}`]: replacement } },
                { arrayFilters: [{ [`entry.${field}`]: match }] }
            );
        })
    );
};

/** Flatten strings, { url } objects and arrays of either into a list of URLs. */
const toUrlList = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.flatMap(toUrlList);
    if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
    return typeof value.url === 'string' ? toUrlList(value.url) : [];
};

/**
 * @param {unknown} previous image value(s) the record held before saving
 * @param {unknown} [current] image value(s) it holds now. A single string also
 *   becomes the image shown on old orders that used the previous file.
 * @returns {Promise<string[]>} filenames removed. Never rejects, so callers may
 *   skip awaiting it and a failed cleanup cannot fail the save.
 */
export const releaseStoredAssets = async (previous, current) => {
    const removed = [];
    try {
        const currentUrls = new Set(toUrlList(current));
        const dropped = [...new Set(toUrlList(previous))].filter((url) => !currentUrls.has(url));
        if (!dropped.length) return removed;

        const replacement = typeof current === 'string' ? current.trim() : '';

        for (const url of dropped) {
            try {
                const filename = await resolveStoredFilename(url);
                if (!filename || (await isReferenced(filename))) continue;
                await updateDisplayCopies(filename, replacement);
                if (await deleteStoredAsset(filename)) removed.push(filename);
            } catch (err) {
                logger.error(`Upload cleanup skipped for ${url}: ${err.message}`);
            }
        }
    } catch (err) {
        logger.error(`Upload cleanup failed: ${err.message}`);
    }
    return removed;
};
