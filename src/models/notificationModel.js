import mongoose from 'mongoose';

const notificationPreferenceSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  notifyByEmail: { 
    type: Boolean, 
    default: true 
  },
});

const NotificationPreference = mongoose.model('NotificationPreference', notificationPreferenceSchema);
export default NotificationPreference;
