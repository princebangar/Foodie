import { sendResponse } from '../../../../utils/response.js';
import {
    createDiamondOrder,
    getAdminDiamondSettings,
    getDiamondTerms,
    getUserDiamond,
    listDiamondMembers,
    saveAdminDiamondSettings,
    verifyDiamondPayment
} from '../services/diamond.service.js';

const wrap = (fn) => async (req, res, next) => {
    try {
        await fn(req, res);
    } catch (error) {
        next(error);
    }
};

// ----- User (Bearer USER) -----
export const getUserDiamondController = wrap(async (req, res) =>
    sendResponse(res, 200, 'Diamond details fetched', await getUserDiamond(req.user?.userId))
);

export const getDiamondTermsController = wrap(async (_req, res) =>
    sendResponse(res, 200, 'Diamond terms fetched', await getDiamondTerms())
);

export const createDiamondOrderController = wrap(async (req, res) =>
    sendResponse(res, 200, 'Diamond payment created', await createDiamondOrder(req.user?.userId))
);

export const verifyDiamondPaymentController = wrap(async (req, res) =>
    sendResponse(res, 200, 'Welcome to Foodie Diamond', await verifyDiamondPayment(req.user?.userId, req.body || {}))
);

// ----- Admin -----
export const getAdminDiamondSettingsController = wrap(async (_req, res) =>
    sendResponse(res, 200, 'Diamond settings fetched', { settings: await getAdminDiamondSettings() })
);

export const saveAdminDiamondSettingsController = wrap(async (req, res) =>
    sendResponse(res, 200, 'Diamond settings saved', { settings: await saveAdminDiamondSettings(req.body || {}) })
);

export const listDiamondMembersController = wrap(async (req, res) =>
    sendResponse(res, 200, 'Diamond members fetched', await listDiamondMembers(req.query || {}))
);
