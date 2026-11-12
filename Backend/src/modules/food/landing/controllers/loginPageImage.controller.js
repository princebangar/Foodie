import mongoose from 'mongoose';
import {
    listLoginPageImages,
    addLoginPageImages,
    reorderLoginPageImages,
    deleteLoginPageImage
} from '../services/loginPageImage.service.js';
import { MAX_LOGIN_PAGE_IMAGES } from '../models/loginPageImage.model.js';
import { sendResponse } from '../../../../utils/response.js';
import { ValidationError } from '../../../../core/auth/errors.js';

const imagesPayload = (images) => ({ images, maxImages: MAX_LOGIN_PAGE_IMAGES });

export const listLoginPageImagesController = async (req, res, next) => {
    try {
        const images = await listLoginPageImages(req.params.appType);
        return sendResponse(res, 200, 'Login page images fetched', imagesPayload(images));
    } catch (error) {
        next(error);
    }
};

export const uploadLoginPageImagesController = async (req, res, next) => {
    try {
        const images = await addLoginPageImages(req.params.appType, req.files);
        return sendResponse(res, 201, 'Login page images uploaded', imagesPayload(images));
    } catch (error) {
        next(error);
    }
};

export const reorderLoginPageImagesController = async (req, res, next) => {
    try {
        const images = await reorderLoginPageImages(req.params.appType, req.body?.orderedIds);
        return sendResponse(res, 200, 'Login page image order updated', imagesPayload(images));
    } catch (error) {
        next(error);
    }
};

export const deleteLoginPageImageController = async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            throw new ValidationError('Invalid image id');
        }
        const images = await deleteLoginPageImage(req.params.appType, req.params.id);
        return sendResponse(res, 200, 'Login page image deleted', imagesPayload(images));
    } catch (error) {
        next(error);
    }
};

/** Public: only what the login page needs to draw its slider. */
export const getPublicLoginPageImagesController = async (req, res, next) => {
    try {
        const images = await listLoginPageImages(req.params.appType);
        return sendResponse(res, 200, 'Login page images fetched', {
            images: images.map(({ _id, imageUrl }) => ({ _id, imageUrl }))
        });
    } catch (error) {
        next(error);
    }
};
