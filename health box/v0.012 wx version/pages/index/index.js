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
    bluetoothState: "未连接", // 未连接/扫描中/已连接
    deviceId: "", // 蓝牙设备ID
    deviceName: "", // 蓝牙设备名称

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

    // 更新服药状态
    this.updateMedicationStatus();

    // 自动检查蓝牙连接状态
    this.getConnectedBluetoothDevices();
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

  // 获取已连接的蓝牙设备
  getConnectedBluetoothDevices: function () {
    const that = this;

    console.log("获取已连接的蓝牙设备");

    // 尝试打开蓝牙适配器
    wx.openBluetoothAdapter({
      success: (res) => {
        console.log("蓝牙适配器初始化成功");

        // 获取已连接的设备
        wx.getConnectedBluetoothDevices({
          success: (res) => {
            console.log("已连接的设备:", res.devices);

            if (res.devices && res.devices.length > 0) {
              // 显示第一个已连接的设备
              const device = res.devices[0];

              // 验证设备是否在白名单中
              const isAuthorized = that.checkDeviceAuthorization(device);

              that.setData({
                isConnected: true,
                bluetoothState: "已连接",
                deviceId: device.deviceId,
                deviceName: device.name || device.localName || "未知设备",
                isAuthorizedDevice: isAuthorized,
              });

              if (isAuthorized) {
                wx.showToast({
                  title:
                    "已连接授权设备: " +
                    (device.name || device.localName || "未知设备"),
                  icon: "success",
                  duration: 2000,
                });
              } else {
                wx.showToast({
                  title: "已连接未授权设备",
                  icon: "none",
                  duration: 2000,
                });
              }
            } else {
              // 没有已连接的设备
              that.setData({
                isConnected: false,
                bluetoothState: "未连接",
                deviceId: "",
                deviceName: "",
                isAuthorizedDevice: false,
              });

              wx.showModal({
                title: "未连接蓝牙设备",
                content: "请在手机系统设置中连接蓝牙设备，然后重新点击此按钮",
                confirmText: "知道了",
                showCancel: false,
              });
            }
          },
          fail: (err) => {
            console.error("获取已连接设备失败", err);

            that.setData({
              isConnected: false,
              bluetoothState: "未连接",
              deviceId: "",
              deviceName: "",
              isAuthorizedDevice: false,
            });

            wx.showModal({
              title: "获取设备失败",
              content: "请确保手机蓝牙已开启，并在系统设置中连接蓝牙设备",
              confirmText: "知道了",
              showCancel: false,
            });
          },
        });
      },
      fail: (err) => {
        console.error("蓝牙适配器初始化失败", err);

        that.setData({
          isConnected: false,
          bluetoothState: "未连接",
          deviceId: "",
          deviceName: "",
          isAuthorizedDevice: false,
        });

        // 根据错误类型显示不同的提示
        if (err.errno === 103 || err.errMsg.includes("auth deny")) {
          wx.showModal({
            title: "蓝牙权限被拒绝",
            content: "需要蓝牙权限来读取设备信息，请在小程序设置中授权蓝牙权限",
            confirmText: "知道了",
            showCancel: false,
          });
        } else if (err.errno === 10001) {
          wx.showToast({
            title: "设备不支持蓝牙",
            icon: "error",
          });
        } else {
          wx.showModal({
            title: "蓝牙未开启",
            content: "请确保手机蓝牙已开启",
            confirmText: "知道了",
            showCancel: false,
          });
        }
      },
    });
  },

  // 切换连接状态 - 简化版本（只显示已连接设备）
  toggleConnection: function () {
    // 直接获取已连接的蓝牙设备
    this.getConnectedBluetoothDevices();
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