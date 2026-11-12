import {
    FoodLoginPageImage,
    LOGIN_PAGE_APP_TYPES,
    MAX_LOGIN_PAGE_IMAGES
} from '../models/loginPageImage.model.js';
import { storeImageBuffer, deleteStoredAsset } from '../../../../services/storage.service.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';

const assertAppType = (appType) => {
    if (!LOGIN_PAGE_APP_TYPES.includes(appType)) {
        throw new ValidationError(`App type must be one of: ${LOGIN_PAGE_APP_TYPES.join(', ')}`);
    }
};

export const listLoginPageImages = async (appType) => {
    assertAppType(appType);
    return FoodLoginPageImage.find({ appType })
        .sort({ sortOrder: 1, createdAt: 1 })
        .limit(MAX_LOGIN_PAGE_IMAGES)
        .lean();
};

export const addLoginPageImages = async (appType, files) => {
    assertAppType(appType);
    if (!files?.length) {
        throw new ValidationError('No files uploaded');
    }
    // The shared multer config also accepts video for other features.
    if (files.some((file) => !String(file.mimetype || '').toLowerCase().startsWith('image/'))) {
        throw new ValidationError('Only image files are allowed');
    }

    const existing = await FoodLoginPageImage.find({ appType })
        .select('sortOrder')
        .sort({ sortOrder: -1 })
        .lean();
    const remaining = MAX_LOGIN_PAGE_IMAGES - existing.length;
    if (files.length > remaining) {
        throw new ValidationError(
            remaining > 0
                ? `Only ${remaining} more image(s) can be added. The limit is ${MAX_LOGIN_PAGE_IMAGES}.`
                : `The limit of ${MAX_LOGIN_PAGE_IMAGES} images is reached. Delete one to add another.`
        );
    }

    let nextOrder = (existing[0]?.sortOrder ?? 0) + 1;
    for (const file of files) {
        const stored = await storeImageBuffer(file.buffer, 'food/login-pages');
        // storeImageBuffer keeps bytes it cannot decode as a .bin file.
        if (stored.format === 'bin') {
            await deleteStoredAsset(stored.secure_url);
            throw new ValidationError(`Could not read "${file.originalname}" as an image`);
        }
        await FoodLoginPageImage.create({
            appType,
            imageUrl: stored.secure_url,
            publicId: stored.public_id,
            sortOrder: nextOrder
        });
        nextOrder += 1;
    }

    return listLoginPageImages(appType);
};

export const reorderLoginPageImages = async (appType, orderedIds) => {
    assertAppType(appType);
    if (!Array.isArray(orderedIds)) {
        throw new ValidationError('orderedIds must be an array');
    }

    const existing = await FoodLoginPageImage.find({ appType }).select('_id').lean();
    const existingIds = new Set(existing.map((doc) => String(doc._id)));
    const requestedIds = new Set(orderedIds.map(String));
    const sameSet = requestedIds.size === existingIds.size
        && orderedIds.length === existingIds.size
        && [...requestedIds].every((id) => existingIds.has(id));
    if (!sameSet) {
        throw new ValidationError('orderedIds must list every image of this app exactly once');
    }

    if (orderedIds.length) {
        await FoodLoginPageImage.bulkWrite(
            orderedIds.map((id, index) => ({
                updateOne: { filter: { _id: id, appType }, update: { $set: { sortOrder: index + 1 } } }
            }))
        );
    }

    return listLoginPageImages(appType);
};

export const deleteLoginPageImage = async (appType, id) => {
    assertAppType(appType);
    const doc = await FoodLoginPageImage.findOne({ _id: id, appType });
    if (!doc) {
        throw new NotFoundError('Login page image not found');
    }

    await doc.deleteOne();
    await deleteStoredAsset(doc.imageUrl || doc.publicId);

    const remaining = await FoodLoginPageImage.find({ appType })
        .select('_id')
        .sort({ sortOrder: 1, createdAt: 1 })
        .lean();
    return reorderLoginPageImages(appType, remaining.map((image) => String(image._id)));
};
