const iotConfig = require("../config/iot.js");

/** 每天有效服药次数（固定为 2 次，对应两个药仓） */
const VALID_TAKE_TOTAL = 2;

/**
 * 华为云物模型属性分组（与影子 reported.properties 字段对应）
 */
const THING_MODEL = {
  timeKeys: ["hour", "minute", "second"],
  envKeys: ["Temp", "Humi", "env_temp_upload", "env_humi_upload"],
  slotDefs: [
    {
      index: 0,
      key: "1",
      title: "药仓一",
      pillCountKey: "pill_count1",
      statusKey: "medicine1_status",
      missedKey: "missed_medicine1_upload",
      validKey: "valid_take1",
    },
    {
      index: 1,
      key: "2",
      title: "药仓二",
      pillCountKey: "pill_count2",
      statusKey: "medicine2_status",
      missedKey: "missed_medicine2_upload",
      validKey: "valid_take2",
    },
  ],
  /** medicineN_status 枚举（与硬件约定一致时可再调整） */
  medicineStatusLabels: {
    0: "空闲",
    1: "正常",
    2: "正在出药",
    3: "需要检查",
  },
};

function pad2(n) {
  const v = Math.floor(Number(n));
  if (Number.isNaN(v)) return "00";
  return String(v).padStart(2, "0");
}

function formatMedStatusCode(code) {
  if (typeof code !== "number" || Number.isNaN(code)) return "还不清楚";
  const label = THING_MODEL.medicineStatusLabels[code];
  if (label) return label;
  return "需要检查";
}

function formatUploadFlag(v) {
  if (v === 1) return "已更新";
  if (v === 0) return "待更新";
  return "";
}

/** 药仓一行摘要：日常只看份量；有异常再补短标签 */
function buildSlotBrief(slot) {
  const count =
    typeof slot.pillCount === "number" ? `剩 ${slot.pillCount} 份` : "—";
  if (slot.missedValue === 1) return `${count} · 可能漏服`;
  if (slot.statusCode === 3) return `${count} · 需检查`;
  return count;
}

function buildIotOverview(props, flags, iotSlots) {
  const temp = pickNumber(props, ["Temp", "temp", "temperature"]);
  const humi = pickNumber(props, ["Humi", "humi", "humidity", "hum"]);
  const et = pickNumber(props, ["env_temp_upload"]);
  const eh = pickNumber(props, ["env_humi_upload"]);

  return {
    time: {
      label: "设备时钟",
      fieldHint: "hour · minute · second",
      synced: Boolean(flags && flags._timeSynced),
    },
    env: {
      label: "仓内环境",
      fieldHint: "Temp · Humi · env_*_upload",
      temperature: typeof temp === "number" ? temp : null,
      humidity: typeof humi === "number" ? humi : null,
      tempUploadText: formatUploadFlag(et),
      humiUploadText: formatUploadFlag(eh),
    },
    slots: (iotSlots || []).map((slot) => ({
      ...slot,
      briefText: slot.briefText || buildSlotBrief(slot),
    })),
  };
}

function enrichMedicationPlansWithSlots(medicationPlans, iotSlots) {
  if (!Array.isArray(medicationPlans) || !Array.isArray(iotSlots)) {
    return medicationPlans;
  }
  return medicationPlans.map((plan, index) => {
    const slot = iotSlots[index];
    if (!slot) return plan;
    const hasMissed = slot.missedValue === 1;
    return {
      ...plan,
      slotKey: slot.key,
      devicePillCount: slot.pillCount,
      deviceStatusHint: slot.statusHint,
      deviceHint: hasMissed ? "可能漏服" : "",
      alertLevel: hasMissed ? "warn" : "",
    };
  });
}

function mapBackendToPageState(payload) {
  const props = payload && payload.properties ? payload.properties : {};
  const temp =
    pickNumber(props, ["Temp", "temp", "temperature"]) ??
    pickNumber(payload, ["temperature"]);
  const humi =
    pickNumber(props, ["Humi", "humi", "humidity", "hum"]) ??
    pickNumber(payload, ["humidity"]);

  const pill1 = pickNumber(props, ["pill_count1"]);
  const pill2 = pickNumber(props, ["pill_count2"]);
  const med1 = pickNumber(props, ["medicine1_status"]);
  const med2 = pickNumber(props, ["medicine2_status"]);

  const hour = pickNumber(props, ["hour"]);
  const minute = pickNumber(props, ["minute"]);
  const second = pickNumber(props, ["second"]);

  const out = {
    isConnected: Boolean(payload && payload.online),
    deviceName: (payload && payload.deviceName) || "medicine_1",
  };

  const timeSynced =
    typeof hour === "number" &&
    typeof minute === "number" &&
    typeof second === "number";

  if (timeSynced) {
    const h = ((Math.floor(hour) % 24) + 24) % 24;
    const mi = ((Math.floor(minute) % 60) + 60) % 60;
    const se = ((Math.floor(second) % 60) + 60) % 60;
    out.deviceHour = h;
    out.deviceMinute = mi;
    out.deviceSecond = se;
    out.deviceTimeText = `${pad2(h)}:${pad2(mi)}:${pad2(se)}`;
  } else {
    out.deviceTimeText = "";
    out.deviceHour = null;
    out.deviceMinute = null;
    out.deviceSecond = null;
  }

  if (typeof temp === "number") {
    out.temperature = temp;
  }
  if (typeof humi === "number") {
    out.humidity = humi;
  }

  const inventoryPatches = [];
  if (typeof pill1 === "number") {
    inventoryPatches.push({ index: 0, portions: pill1 });
  }
  if (typeof pill2 === "number") {
    inventoryPatches.push({ index: 1, portions: pill2 });
  }

  const miss1 = pickNumber(props, ["missed_medicine1_upload"]);
  const miss2 = pickNumber(props, ["missed_medicine2_upload"]);
  const valid1 = pickNumber(props, ["valid_take1"]);
  const valid2 = pickNumber(props, ["valid_take2"]);
  const et = pickNumber(props, ["env_temp_upload"]);
  const eh = pickNumber(props, ["env_humi_upload"]);

  const flags = {
    _timeSynced: timeSynced,
    medicine1_status: med1,
    medicine2_status: med2,
    missed_medicine1_upload: miss1,
    missed_medicine2_upload: miss2,
    env_temp_upload: et,
    env_humi_upload: eh,
    valid_take1: valid1,
    valid_take2: valid2,
  };

  if (et === 1 && eh === 1) {
    out.envUploadSummary = "温湿度已与药盒同步";
  } else if (et === 1 || eh === 1) {
    out.envUploadSummary = "部分数据已与药盒同步";
  } else {
    out.envUploadSummary = "";
  }

  out.iotSlots = [
    buildSlotView("1", "药仓一", pill1, med1, miss1, valid1),
    buildSlotView("2", "药仓二", pill2, med2, miss2, valid2),
  ];

  out.iotOverview = buildIotOverview(props, flags, out.iotSlots);

  return { out, inventoryPatches, rawProperties: props, flags };
}

function buildSlotView(key, title, pillCount, statusCode, missed, valid) {
  const slot = {
    key,
    title,
    statusCode: typeof statusCode === "number" ? statusCode : null,
    statusHint: formatMedStatusCode(statusCode),
    pillCount: typeof pillCount === "number" ? pillCount : null,
    missedValue: typeof missed === "number" ? missed : null,
    validValue: typeof valid === "number" ? valid : null,
  };
  slot.briefText = buildSlotBrief(slot);
  return slot;
}

function pickNumber(obj, keys) {
  if (!obj) return undefined;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      const v = obj[k];
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return undefined;
}

function applyInventoryPatches(medicineInventory, patches) {
  if (!Array.isArray(medicineInventory) || !patches.length) {
    return medicineInventory;
  }
  let list = medicineInventory;
  patches.forEach((p) => {
    if (typeof p.index !== "number" || typeof p.portions !== "number") return;
    if (!list[p.index]) return;
    if (list === medicineInventory) list = [...medicineInventory];
    list[p.index] = { ...list[p.index], portions: p.portions };
  });
  return list;
}

function fetchLatestState() {
  const base = (iotConfig.apiBase || "").trim();
  if (!base) {
    return Promise.reject(new Error("IOT_API_BASE_EMPTY"));
  }
  const url = `${base}${iotConfig.latestStatePath || "/iot/latest"}`;
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: "GET",
      timeout: 10000,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(new Error(`HTTP_${res.statusCode}`));
        }
      },
      fail(err) {
        reject(err);
      },
    });
  });
}

function getFixedValidTakeDisplay() {
  return {
    validTakeTotal: VALID_TAKE_TOTAL,
    validTakeDone: VALID_TAKE_TOTAL,
  };
}

module.exports = {
  THING_MODEL,
  VALID_TAKE_TOTAL,
  mapBackendToPageState,
  applyInventoryPatches,
  enrichMedicationPlansWithSlots,
  getFixedValidTakeDisplay,
  fetchLatestState,
  getPollIntervalMs: () =>
    Math.max(5000, Number(iotConfig.pollIntervalMs) || 15000),
};
