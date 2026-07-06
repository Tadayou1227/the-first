/**
 * 物联网数据配置
 *
 * 微信小程序只能请求已配置的 HTTPS 合法域名，且不应把华为云 AK/SK 写在小程序里。
 * 通常做法：华为云「数据转发」或你自己的后端调用 IoTDA API，小程序只请求你的域名。
 *
 * apiBase 为空字符串时，首页仍使用本地模拟数据（当前开发默认）。
 */
module.exports = {
  /** 例如 https://api.your-domain.com（不要末尾斜杠） */
  apiBase: "",
  /** GET，返回 JSON：见 utils/iotClient.js 注释中的约定格式 */
  latestStatePath: "/iot/latest",
  pollIntervalMs: 15000,
};
