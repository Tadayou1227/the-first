// 智能药盒 - 简洁老年友好版逻辑
Page({
  // 页面数据
  data: {
    // 当前页面
    currentPage: "home",

    // 当前时间
    currentTime: "",

    // 连接状态
    isConnected: false,
    deviceName: "云端设备", // 云端设备名称

    // 服药计划
    medicationPlans: [
      { medicine: "降压药", time: "08:00", taken: true },
      { medicine: "降糖药", time: "12:00", taken: true },
      { medicine: "心脏药", time: "18:00", taken: false },
    ],

    // 服药统计
    takenCount: 2,
    totalCount: 3,

    // 设置项
    voiceEnabled: true,
    soundEnabled: true,
    vibrationEnabled: true,
    familyPhone: "未设置",
    hospitalPhone: "未设置",

    // 隐藏的后端白名单（管理员可修改）
    isAuthorizedDevice: false,
  },

  // 页面加载
  onLoad: function () {
    // 更新时间
    this.updateTime();
    setInterval(() => this.updateTime(), 1000);

    // 初始化云端连接状态
    this.initCloudConnection();

    // 获取云端服药数据
    this.getCloudMedicationData();
  },

  // 更新时间显示
  updateTime: function () {
    const now = new Date();
    const timeString = now.toLocaleString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    this.setData({
      currentTime: timeString,
    });
  },

  // 更新服药状态
  updateMedicationStatus: function () {
    const takenCount = this.data.medicationPlans.filter(
      (plan) => plan.taken,
    ).length;
    const totalCount = this.data.medicationPlans.length;

    this.setData({
      takenCount: takenCount,
      totalCount: totalCount,
    });
  },

  // 初始化云端连接
  initCloudConnection: function () {
    console.log("初始化云端连接");

    // 华为云API调用占位符
    // TODO: 实现华为云设备状态查询
    this.setData({
      isConnected: true,
      deviceName: "云端设备",
    });
  },

  // 刷新云端设备状态
  refreshCloudStatus: function () {
    console.log("刷新云端设备状态");

    // TODO: 实现华为云设备状态查询API
    // 示例：调用华为云设备管理API获取设备状态

    this.setData({
      isConnected: true,
      deviceName: "云端设备",
    });

    wx.showToast({
      title: "云端状态已刷新",
      icon: "success",
      duration: 1500,
    });
  },

  // 获取云端服药数据
  getCloudMedicationData: function () {
    console.log("获取云端服药数据");

    // TODO: 实现华为云服药数据查询API
    // 示例：调用华为云数据查询API获取服药记录

    // 暂时使用模拟数据
    const mockData = [
      { medicine: "降压药", time: "08:00", taken: true },
      { medicine: "降糖药", time: "12:00", taken: true },
      { medicine: "心脏药", time: "18:00", taken: false },
    ];

    this.setData({
      medicationPlans: mockData,
    });

    this.updateMedicationStatus();
  },

  // 切换连接状态 - 云端版本
  toggleConnection: function () {
    // 刷新云端设备状态
    this.refreshCloudStatus();
  },

  // 页面导航
  switchToHome: function () {
    this.setData({
      currentPage: "home",
    });
  },

  switchToPlan: function () {
    this.setData({
      currentPage: "plan",
    });
  },

  switchToRecord: function () {
    this.setData({
      currentPage: "record",
    });
  },

  switchToSettings: function () {
    this.setData({
      currentPage: "settings",
    });
  },

  // 功能页面跳转
  goToPlanPage: function () {
    this.switchToPlan();
  },

  goToRecordPage: function () {
    this.switchToRecord();
  },

  // 紧急求助
  emergencyCallFamily: function () {
    wx.showModal({
      title: "紧急求助",
      content: "正在呼叫家人...",
      showCancel: false,
    });
  },

  // 隐藏的后端白名单验证
  checkDeviceAuthorization: function (device) {
    // 管理员可在此处修改白名单设备信息
    const backendWhitelist = [
      { name: "智能药盒", deviceId: "药盒设备ID" },
      { name: "备用药盒", deviceId: "备用设备ID" },
    ];

    // 验证设备是否在白名单中
    const isAuthorized = backendWhitelist.some((authorizedDevice) => {
      // 可以根据设备名称或设备ID进行验证
      return (
        authorizedDevice.name === device.name ||
        authorizedDevice.deviceId === device.deviceId
      );
    });

    this.setData({
      isAuthorizedDevice: isAuthorized,
    });

    return isAuthorized;
  },

  emergencyCallHospital: function () {
    wx.showModal({
      title: "紧急求助",
      content: "正在呼叫急救中心...",
      showCancel: false,
    });
  },

  // 设置相关功能
  toggleVoice: function (e) {
    this.setData({
      voiceEnabled: e.detail.value,
    });
  },

  toggleSound: function (e) {
    this.setData({
      soundEnabled: e.detail.value,
    });
  },

  toggleVibration: function (e) {
    this.setData({
      vibrationEnabled: e.detail.value,
    });
  },

  onFamilyPhoneInput: function (e) {
    this.setData({
      familyPhone: e.detail.value,
    });
  },

  onHospitalPhoneInput: function (e) {
    this.setData({
      hospitalPhone: e.detail.value,
    });
  },

  saveSettings: function () {
    wx.showToast({
      title: "设置已保存",
      icon: "success",
    });
  },
});
