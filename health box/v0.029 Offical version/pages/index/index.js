const iotConfig = require("../../config/iot.js");
const {
  fetchLatestState,
  mapBackendToPageState,
  applyInventoryPatches,
  enrichMedicationPlansWithSlots,
  getFixedValidTakeDisplay,
  getPollIntervalMs,
} = require("../../utils/iotClient.js");
const HISTORY_STORAGE_KEY = "globalMedicationHistory";

/** IAM 登录名（子用户就填子用户名） */
const HW_IAM_USER_NAME = "genshingreat";
/**
 * 租户「账号名」：控制台右上角账号下拉 → 账号中心里看到的名称。
 * 常见 401 原因：这里误填成 IAM 用户名；子用户登录时这里应填主账号的账号名。
 */
const HW_IAM_DOMAIN_NAME = "hw020762260";
/** 勿把含密码的工程上传到公开仓库；上线建议改走后端换票 */
const HW_IAM_PASSWORD = "Ss1643894865";

/** 无影子时的默认温湿度展示 */
const DISPLAY_TEMP = 28;
const DISPLAY_HUMI = 44;

function hasIotBackend() {
  return Boolean((iotConfig.apiBase || "").trim());
}

function usesHuaweiDirectShadow() {
  return Boolean(HW_IAM_PASSWORD && !hasIotBackend());
}

Page({
  data: {
    currentPage: "home",
    isConnected: false,
    deviceName: "medicine_1",
    /** 与硬件双药仓对应：仅 2 条 */
    medicationPlans: [
      { medicine: "药仓一", taken: false },
      { medicine: "药仓二", taken: false },
    ],
    medicationHistory: [
      { medicine: "药仓一", status: "已服药" },
      { medicine: "药仓二", status: "已服药" },
    ],
    validTakeTotal: 2,
    validTakeDone: 2,
    medicineInventory: [
      {
        name: "药仓一",
        portions: 3,
        expireDate: "",
        lowStockThreshold: 3,
      },
      {
        name: "药仓二",
        portions: 3,
        expireDate: "",
        lowStockThreshold: 3,
      },
    ],
    expiredMedicines: [],
    lowStockMedicines: [],
    totalPortions: 0,
    takenCount: 0,
    totalCount: 2,
    temperature: DISPLAY_TEMP,
    humidity: DISPLAY_HUMI,
    deviceTimeText: "",
    /** 设备时间基准（与 deviceTimeText 同步；每秒在页面上递增） */
    deviceHour: null,
    deviceMinute: null,
    deviceSecond: null,
    envUploadSummary: "",
    iotSlots: [],
    iotOverview: null,
    voiceEnabled: true,
    soundEnabled: true,
    vibrationEnabled: true,
    isAuthorizedDevice: false,
    todoItems: ["20:00 补充明天早上的降压药"],
    promptItems: [],
    currentPromptIndex: 0,
    isPromptExpanded: false,
    iotFlags: null,
    /** 华为云：下发 message 内容 */
    control: "ON",
    /** 华为云：影子/状态展示用 */
    ledStatus: "",
  },
  clockTimer: null,
  iotPollTimer: null,
  shadowPollTimer: null,

  onLoad: function () {
    this.updateTime();
    this.clockTimer = setInterval(() => this.updateTime(), 1000);
    this.initCloudConnection();
    this.getCloudMedicationData();
    this.loadGlobalHistory();
    this.updateInventoryAnalysis();
    this.refreshPromptItems();
    if (hasIotBackend()) {
      this.startIotPolling();
    }
    if (usesHuaweiDirectShadow()) {
      this.gettoken(() => this.getyingzhi());
      if (this.shadowPollTimer) {
        clearInterval(this.shadowPollTimer);
      }
      this.shadowPollTimer = setInterval(() => {
        this.getyingzhi();
      }, 30000);
    }
  },
  onUnload: function () {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }
    if (this.iotPollTimer) {
      clearInterval(this.iotPollTimer);
      this.iotPollTimer = null;
    }
    if (this.shadowPollTimer) {
      clearInterval(this.shadowPollTimer);
      this.shadowPollTimer = null;
    }
  },

  applyReportedPropertiesFromShadow: function (properties) {
    if (!properties || typeof properties !== "object") {
      return;
    }
    const payload = {
      online: true,
      deviceName: this.data.deviceName || "medicine_1",
      properties,
    };
    const { out, inventoryPatches, flags } = mapBackendToPageState(payload);
    const nextInventory = applyInventoryPatches(
      this.data.medicineInventory,
      inventoryPatches,
    );
    const patch = {
      ...out,
      iotFlags: flags,
      ledStatus: JSON.stringify(properties),
      ...getFixedValidTakeDisplay(),
    };
    if (out.iotSlots && out.iotSlots.length) {
      patch.medicationPlans = enrichMedicationPlansWithSlots(
        this.data.medicationPlans,
        out.iotSlots,
      );
    }
    if (nextInventory !== this.data.medicineInventory) {
      patch.medicineInventory = nextInventory;
    }
    this.setData(patch, () => {
      this.updateInventoryAnalysis();
      this.refreshPromptItems();
    });
  },

  /** 1. 取 Token（微信里 header 键多为小写，需兼容 x-subject-token） */
  gettoken: function (callback) {
    wx.request({
      url: "https://iam.cn-east-3.myhuaweicloud.com/v3/auth/tokens",
      method: "POST",
      timeout: 60000,
      header: { "Content-Type": "application/json;charset=UTF-8" },
      data: {
        auth: {
          identity: {
            methods: ["password"],
            password: {
              user: {
                name: HW_IAM_USER_NAME,
                password: HW_IAM_PASSWORD,
                domain: { name: HW_IAM_DOMAIN_NAME },
              },
            },
          },
          scope: {
            project: { id: "019df25d18a27c34bc89c2aa251b8939" },
          },
        },
      },
      success: (res) => {
        if (res.statusCode !== 200 && res.statusCode !== 201) {
          console.error(
            "[IAM] 换票失败 HTTP",
            res.statusCode,
            "华为返回:",
            res.data,
          );
          return;
        }
        const h = res.header || {};
        const token =
          h["X-Subject-Token"] || h["x-subject-token"] || h["X-subject-token"];
        if (token) {
          wx.setStorageSync("token", token);
          console.log("Token 获取成功");
          if (typeof callback === "function") callback();
        } else {
          console.error("Token 缺失（HTTP 成功但无头）", res.header);
        }
      },
      fail: (err) => {
        console.error("Token 请求失败", err);
      },
    });
  },

  /** 2. 设备影子 */
  getyingzhi: function () {
    console.log("开始获取影子");
    const token = wx.getStorageSync("token");
    wx.request({
      url: "https://1e0b5df7e4.st1.iotda-app.cn-east-3.myhuaweicloud.com:443/v5/iot/019df25d18a27c34bc89c2aa251b8939/devices/69faaea1e094d6159239e3bb_0001/shadow",
      method: "GET",
      timeout: 60000,
      header: {
        "Content-Type": "application/json;charset=UTF-8",
        "X-Auth-Token": token,
        "Instance-Id": "1d8987b4-d058-44fe-baa6-1c525fb35dd8",
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.shadow) {
          const properties = res.data.shadow[0].reported.properties;
          console.log("获取影子成功:", properties);
          this.applyReportedPropertiesFromShadow(properties);
        }
      },
      fail: (err) => {
        console.error("影子请求失败", err);
      },
    });
  },

  /** 3. 下发命令 */
  sendData: function () {
    console.log("开始下发命令...");
    const token = wx.getStorageSync("token");
    wx.request({
      url: "https://1e0b5df7e4.st1.iotda-app.cn-east-3.myhuaweicloud.com:443/v5/iot/019df25d18a27c34bc89c2aa251b8939/devices/69faaea1e094d6159239e3bb_0001/messages",
      method: "POST",
      timeout: 60000,
      header: {
        "Content-Type": "application/json",
        "X-Auth-Token": token,
        "Instance-Id": "1d8987b4-d058-44fe-baa6-1c525fb35dd8",
      },
      data: { message: this.data.control },
      success: () => {
        console.log("命令下发成功");
      },
      fail: (err) => {
        console.error("下发失败", err);
      },
    });
  },

  updateTime: function () {
    const patch = {};
    const dh = this.data.deviceHour;
    const dm = this.data.deviceMinute;
    const ds = this.data.deviceSecond;
    if (
      typeof dh === "number" &&
      !Number.isNaN(dh) &&
      typeof dm === "number" &&
      !Number.isNaN(dm) &&
      typeof ds === "number" &&
      !Number.isNaN(ds)
    ) {
      let h = dh;
      let m = dm;
      let s = ds + 1;
      if (s >= 60) {
        s = 0;
        m += 1;
        if (m >= 60) {
          m = 0;
          h = (h + 1) % 24;
        }
      }
      const pad = (n) => String(n).padStart(2, "0");
      patch.deviceHour = h;
      patch.deviceMinute = m;
      patch.deviceSecond = s;
      patch.deviceTimeText = `${pad(h)}:${pad(m)}:${pad(s)}`;
    }

    if (Object.keys(patch).length === 0) {
      return;
    }
    this.setData(patch);
  },

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

  initCloudConnection: function () {
    if (hasIotBackend()) {
      this.syncFromCloud({ silent: true });
      return;
    }
    this.setData({
      isConnected: true,
      deviceName: "medicine_1",
    });
  },

  startIotPolling: function () {
    const ms = getPollIntervalMs();
    if (this.iotPollTimer) {
      clearInterval(this.iotPollTimer);
    }
    this.iotPollTimer = setInterval(() => {
      this.syncFromCloud({ silent: true });
    }, ms);
  },

  /**
   * 从你在 config/iot.js 配置的 HTTPS 后端拉取最新设备状态（由后端对接华为云 IoTDA）。
   */
  syncFromCloud: function (options) {
    const silent = options && options.silent;
    if (!hasIotBackend()) {
      if (!silent) {
        wx.showToast({ title: "请先在 config/iot.js 填写 apiBase", icon: "none" });
      }
      return;
    }
    fetchLatestState()
      .then((payload) => {
        const { out, inventoryPatches, flags } = mapBackendToPageState(payload);
        const nextInventory = applyInventoryPatches(
          this.data.medicineInventory,
          inventoryPatches,
        );
        const patch = {
          ...out,
          iotFlags: flags,
          ...getFixedValidTakeDisplay(),
        };
        delete patch.temperature;
        delete patch.humidity;
        if (out.iotSlots && out.iotSlots.length) {
          patch.medicationPlans = enrichMedicationPlansWithSlots(
            this.data.medicationPlans,
            out.iotSlots,
          );
        }
        if (nextInventory !== this.data.medicineInventory) {
          patch.medicineInventory = nextInventory;
        }
        this.setData(patch, () => {
          this.updateInventoryAnalysis();
          this.refreshPromptItems();
        });
        if (!silent) {
          wx.showToast({ title: "已同步云端数据", icon: "success", duration: 1200 });
        }
      })
      .catch(() => {
        this.setData({
          isConnected: false,
        });
        if (!silent) {
          wx.showToast({ title: "云端同步失败", icon: "none" });
        }
      });
  },

  refreshCloudStatus: function () {
    if (hasIotBackend()) {
      this.syncFromCloud({ silent: false });
      return;
    }
    if (usesHuaweiDirectShadow()) {
      this.gettoken(() => {
        this.getyingzhi();
        wx.showToast({ title: "已从华为云更新", icon: "success", duration: 1200 });
      });
      return;
    }
    this.setData({
      isConnected: true,
      deviceName: "medicine_1",
    });

    wx.showToast({
      title: "云端状态已刷新",
      icon: "success",
      duration: 1500,
    });
  },

  getCloudMedicationData: function () {
    if (hasIotBackend()) {
      return;
    }
    const mockPayload = {
      online: true,
      deviceName: "medicine_1",
      properties: {
        hour: 13,
        minute: 32,
        second: 49,
        Temp: DISPLAY_TEMP,
        Humi: DISPLAY_HUMI,
        medicine1_status: 1,
        medicine2_status: 1,
        pill_count1: 3,
        pill_count2: 3,
        missed_medicine1_upload: 0,
        missed_medicine2_upload: 0,
        env_temp_upload: 0,
        env_humi_upload: 0,
        valid_take1: 1,
        valid_take2: 1,
      },
    };
    const { out, inventoryPatches, flags } = mapBackendToPageState(mockPayload);
    const nextInventory = applyInventoryPatches(
      this.data.medicineInventory,
      inventoryPatches,
    );
    const plans = enrichMedicationPlansWithSlots(
      [
        { medicine: "药仓一", taken: false },
        { medicine: "药仓二", taken: false },
      ],
      out.iotSlots,
    );
    this.setData({
      ...out,
      medicationPlans: plans,
      iotFlags: flags,
      medicineInventory: nextInventory,
      temperature: DISPLAY_TEMP,
      humidity: DISPLAY_HUMI,
      ...getFixedValidTakeDisplay(),
    }, () => {
      this.updateInventoryAnalysis();
    });

    this.updateMedicationStatus();
  },
  loadGlobalHistory: function () {
    const storedHistory = wx.getStorageSync(HISTORY_STORAGE_KEY);
    if (Array.isArray(storedHistory) && storedHistory.length) {
      this.setData({
        medicationHistory: storedHistory,
      });
      return;
    }
    this.persistGlobalHistory(this.data.medicationHistory);
  },
  persistGlobalHistory: function (historyList) {
    wx.setStorageSync(HISTORY_STORAGE_KEY, historyList);
  },

  toggleConnection: function () {
    this.refreshCloudStatus();
  },

  switchToHome: function () {
    if (this.data.currentPage === "home") return;
    this.setData({
      currentPage: "home",
    });
  },

  switchToPlan: function () {
    if (this.data.currentPage === "plan") return;
    this.setData({
      currentPage: "plan",
    });
  },

  switchToRecord: function () {
    if (this.data.currentPage === "record") return;
    this.setData({
      currentPage: "record",
    });
  },

  switchToSettings: function () {
    if (this.data.currentPage === "settings") return;
    this.setData({
      currentPage: "settings",
    });
  },

  goToPlanPage: function () {
    this.switchToPlan();
  },

  goToRecordPage: function () {
    this.switchToRecord();
  },
  togglePromptExpand: function () {
    this.setData({
      isPromptExpanded: !this.data.isPromptExpanded,
    });
  },
  goToGlobalHistoryPage: function () {
    wx.navigateTo({
      url: "/pages/history/history",
    });
  },

  checkDeviceAuthorization: function (device) {
    const backendWhitelist = [
      { name: "智能药盒", deviceId: "药盒设备ID" },
      { name: "备用药盒", deviceId: "备用设备ID" },
    ];
    const isAuthorized = backendWhitelist.some((authorizedDevice) => {
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

  updateInventoryAnalysis: function () {
    const today = new Date();
    const expiredMedicines = this.data.medicineInventory.filter((item) => {
      if (!item.expireDate || String(item.expireDate).trim() === "") return false;
      const expireDate = new Date(item.expireDate);
      if (Number.isNaN(expireDate.getTime())) return false;
      return expireDate < today;
    });
    const lowStockMedicines = this.data.medicineInventory.filter(
      (item) => Number(item.portions) <= Number(item.lowStockThreshold),
    );
    const totalPortions = this.data.medicineInventory.reduce(
      (sum, item) => sum + Number(item.portions || 0),
      0,
    );
    this.setData({
      expiredMedicines,
      lowStockMedicines,
      totalPortions,
    });
    this.refreshPromptItems();
  },
  refreshPromptItems: function () {
    const firstTodo = this.data.todoItems[0];
    const expiredCount = this.data.expiredMedicines.length;
    const lowStockCount = this.data.lowStockMedicines.length;
    const slots = this.data.iotSlots || [];
    const slotAlerts = slots
      .filter((s) => s.missedValue === 1)
      .map((s) => `${s.title}可能漏服，请看看是否按时吃药`);
    let hardwareHint = "连上药盒后可查看药量。";
    if (slots.length) {
      hardwareHint = slots.map((s) => `${s.title} ${s.briefText}`).join("；");
    }
    if (slotAlerts.length) {
      hardwareHint = `${slotAlerts.join("；")}。${hardwareHint}`;
    }
    const promptItems = [
      {
        title: "药盒情况",
        detail: hardwareHint,
      },
      {
        title: "有效服药",
        detail: `今天有效服药 ${this.data.validTakeDone}/${this.data.validTakeTotal} 次`,
      },
      {
        title: "待办",
        detail: firstTodo || "今天没有别的事要提醒。",
      },
      {
        title: "药量和保质期",
        detail:
          expiredCount > 0
            ? `有 ${expiredCount} 格药已超过您填的保质期，请及时处理。`
            : lowStockCount > 0
              ? `有 ${lowStockCount} 格药快吃完了，记得补充。`
              : "药量还够，也没有过期的（没填保质期就不会提示过期）。",
      },
    ];
    this.setData({
      promptItems,
      currentPromptIndex: 0,
      isPromptExpanded: false,
    });
  },
  markAsTaken: function (e) {
    const index = Number(e.currentTarget.dataset.index);
    const medicationPlans = [...this.data.medicationPlans];
    if (!medicationPlans[index] || medicationPlans[index].taken) return;

    const selectedMedicine = medicationPlans[index];
    medicationPlans[index].taken = true;
    const medicationHistory = [
      {
        medicine: selectedMedicine.medicine,
        status: "已服药",
      },
      ...this.data.medicationHistory,
    ];
    const medicineInventory = this.data.medicineInventory.map((item) => {
      if (item.name !== selectedMedicine.medicine) return item;
      return {
        ...item,
        portions: Math.max(0, Number(item.portions) - 1),
      };
    });

    const enrichedPlans = enrichMedicationPlansWithSlots(
      medicationPlans,
      this.data.iotSlots,
    );

    this.setData({
      medicationPlans: enrichedPlans,
      medicationHistory,
      medicineInventory,
    });
    this.persistGlobalHistory(medicationHistory);
    this.updateMedicationStatus();
    this.updateInventoryAnalysis();
    this.refreshPromptItems();
  },
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

  saveSettings: function () {
    wx.showToast({
      title: "设置已保存",
      icon: "success",
    });
  },
});
