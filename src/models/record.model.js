const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be at least 0.01']
    },
    type: {
      type: String,
      required: [true, 'Type is required'],
      enum: {
        values: ['INCOME', 'EXPENSE'],
        message: '{VALUE} is not a valid type'
      }
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      maxlength: [100, 'Category must be less than 100 characters long']
    },
    date: {
      type: Date,
      required: [true, 'Date is required']
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes must be less than 500 characters long']
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'CreatedBy (User ID) is required']
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        
        // Ensure date is formatted as ISO string
        if (ret.date) {
            ret.date = ret.date.toISOString();
        }
      }
    }
  }
);

recordSchema.index({ type: 1 });
recordSchema.index({ category: 1 });
recordSchema.index({ date: 1 });
recordSchema.index({ isDeleted: 1 });
recordSchema.index({ type: 1, category: 1, date: -1 });

const FinancialRecord = mongoose.model('FinancialRecord', recordSchema);

module.exports = FinancialRecord;
