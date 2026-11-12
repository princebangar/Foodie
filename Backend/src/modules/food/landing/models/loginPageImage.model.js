import mongoose from 'mongoose';

export const LOGIN_PAGE_APP_TYPES = ['user', 'restaurant', 'delivery'];
export const MAX_LOGIN_PAGE_IMAGES = 5;

const foodLoginPageImageSchema = new mongoose.Schema(
    {
        appType: {
            type: String,
            enum: LOGIN_PAGE_APP_TYPES,
            required: true
        },
        imageUrl: {
            type: String,
            required: true
        },
        publicId: {
            type: String,
            required: true
        },
        sortOrder: {
            type: Number,
            default: 0
        }
    },
    {
        collection: 'food_login_page_images',
        timestamps: true
    }
);

foodLoginPageImageSchema.index({ appType: 1, sortOrder: 1 });

export const FoodLoginPageImage = mongoose.model('FoodLoginPageImage', foodLoginPageImageSchema);
