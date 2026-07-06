Component({
  properties: {
    ec: {
      type: Object,
      value: null,
      observer: function () {
        this.tryInit();
      },
    },
  },
  data: {
    chart: null,
    initialized: false,
  },
  lifetimes: {
    ready: function () {
      this.tryInit();
    },
  },
  methods: {
    tryInit: function () {
      if (this.data.initialized) return;
      const ec = this.properties.ec;
      if (!ec || typeof ec.onInit !== "function") return;

      const query = this.createSelectorQuery();
      query
        .select("#ecCanvas")
        .boundingClientRect((rect) => {
          if (!rect) return;
          const width = rect.width || 320;
          const height = rect.height || 240;
          const dpr = wx.getSystemInfoSync().pixelRatio || 1;
          const adapter = {
            setChart: (chart) => {
              this.setData({ chart });
            },
            drawOption: (option) => {
              this.drawLineChart(option, width, height);
            },
          };
          ec.onInit(adapter, width, height, dpr);
          this.setData({ initialized: true });
        })
        .exec();
    },
    drawLineChart: function (option, width, height) {
      const ctx = wx.createCanvasContext("ecCanvas", this);
      const padding = { left: 30, right: 14, top: 24, bottom: 24 };
      const drawWidth = width - padding.left - padding.right;
      const drawHeight = height - padding.top - padding.bottom;
      const labels = (option && option.xAxis && option.xAxis.data) || [];
      const series = (option && option.series) || [];
      if (!labels.length || !series.length) {
        ctx.clearRect(0, 0, width, height);
        ctx.draw();
        return;
      }

      const values = [];
      series.forEach((s) => {
        (s.data || []).forEach((v) => values.push(Number(v)));
      });
      const minVal = Math.min.apply(null, values);
      const maxVal = Math.max.apply(null, values);
      const range = maxVal - minVal || 1;

      ctx.clearRect(0, 0, width, height);
      ctx.setStrokeStyle("#e6e6e6");
      ctx.setLineWidth(1);
      ctx.beginPath();
      ctx.moveTo(padding.left, padding.top);
      ctx.lineTo(padding.left, height - padding.bottom);
      ctx.lineTo(width - padding.right, height - padding.bottom);
      ctx.stroke();

      const colors = ["#ff6b6b", "#4dabf7", "#69db7c"];
      series.forEach((line, lineIndex) => {
        const lineData = line.data || [];
        if (!lineData.length) return;
        ctx.beginPath();
        ctx.setStrokeStyle(colors[lineIndex % colors.length]);
        ctx.setLineWidth(2);
        lineData.forEach((raw, i) => {
          const x =
            padding.left +
            (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * drawWidth);
          const y =
            padding.top +
            drawHeight -
            ((Number(raw) - minVal) / range) * drawHeight;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      });

      ctx.setFillStyle("#8e8e93");
      ctx.setFontSize(10);
      ctx.fillText(`${minVal}`, 4, height - padding.bottom + 4);
      ctx.fillText(`${maxVal}`, 4, padding.top);
      ctx.fillText(labels[0] || "", padding.left, height - 6);
      ctx.fillText(labels[labels.length - 1] || "", width - padding.right - 30, height - 6);
      ctx.draw();
    },
  },
});
