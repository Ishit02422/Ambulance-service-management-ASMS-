const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    action: { type: String, required: true },
    targetCollection: { type: String, required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    before: { type: Object },
    after: { type: Object },
    timestamp: { type: Date, default: Date.now, index: true },
  }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
