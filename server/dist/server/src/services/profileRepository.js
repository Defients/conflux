"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveProfile = exports.getProfile = void 0;
const firebaseAdmin_1 = require("../firebaseAdmin");
const getProfile = async (userId) => {
    if (!firebaseAdmin_1.db)
        return null;
    try {
        const docSnap = await firebaseAdmin_1.db.collection('profiles').doc(userId).get();
        if (docSnap.exists) {
            return docSnap.data();
        }
    }
    catch (err) {
        console.error('Error fetching profile for user', userId, err);
    }
    return null;
};
exports.getProfile = getProfile;
const saveProfile = async (userId, profile) => {
    if (!firebaseAdmin_1.db)
        return;
    try {
        await firebaseAdmin_1.db.collection('profiles').doc(userId).set(profile);
    }
    catch (err) {
        console.error('Error saving profile for user', userId, err);
    }
};
exports.saveProfile = saveProfile;
//# sourceMappingURL=profileRepository.js.map