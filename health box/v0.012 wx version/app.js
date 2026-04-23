// app.js - 智能药盒小程序入口文件
App({
  // 小程序启动时触发
  onLaunch: function () {
    console.log("智能药盒小程序启动");

    // 检查更新
    this.checkForUpdate();

    // 初始化数据
    this.initData();
  },

  // 小程序显示时触发
  onShow: function () {
    console.log("智能药盒小程序显示");
  },

  // 小程序隐藏时触发
  onHide: function () {
    console.log("智能药盒小程序隐藏");
  },

  // 检查小程序更新
  checkForUpdate: function () {
    if (wx.canIUse("getUpdateManager")) {
      const updateManager = wx.getUpdateManager();

      updateManager.onCheckForUpdate(function (res) {
        if (res.hasUpdate) {
          console.log("发现新版本");
        }
      });

      updateManager.onUpdateReady(function () {
        wx.showModal({
          title: "更新提示",
          content: "新版本已准备好，是否重启应用？",
          success: function (res) {
            if (res.confirm) {
              updateManager.applyUpdate();
            }
          },
        });
      });

      updateManager.onUpdateFailed(function () {
        wx.showToast({
          title: "更新失败",
          icon: "none",
        });
      });
    }
  },

  // 初始化数据
  initData: function () {
    // 可以在这里初始化一些全局数据
    console.log("初始化全局数据");
  },
});