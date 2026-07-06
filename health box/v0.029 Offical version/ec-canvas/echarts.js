function init(canvas) {
  return {
    setOption(option) {
      if (canvas && typeof canvas.drawOption === "function") {
        canvas.drawOption(option || {});
      }
    },
  };
}

export { init };
