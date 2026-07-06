const HISTORY_STORAGE_KEY = "globalMedicationHistory";

Page({
  data: {
    historyList: [],
  },
  onShow: function () {
    const historyList = wx.getStorageSync(HISTORY_STORAGE_KEY) || [];
    this.setData({
      historyList,
    });
  },
});
