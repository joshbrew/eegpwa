import { scaleLinear } from "d3-scale";
import { EventDispatcher } from './utils';
function maxMin(arr) {
    let max = -Infinity;
    let min = Infinity;
    for (const v of arr) {
        if (v > max)
            max = v;
        if (v < min)
            min = v;
    }
    return { max, min };
}
export class RenderModel {
    constructor(options) {
        this.options = options;
        this.xScale = scaleLinear();
        this.yScale = scaleLinear();
        this.xRange = null;
        this.yRange = null;
        this.seriesInfo = new Map();
        this.resized = new EventDispatcher();
        this.updated = new EventDispatcher();
        this.disposing = new EventDispatcher();
        this.disposed = false;
        this.redrawRequested = false;
        if (options.xRange !== 'auto' && options.xRange) {
            this.xScale.domain([options.xRange.min, options.xRange.max]);
        }
        if (options.yRange !== 'auto' && options.yRange) {
            this.yScale.domain([options.yRange.min, options.yRange.max]);
        }
    }
    resize(width, height) {
        const op = this.options;
        this.xScale.range([op.paddingLeft, width - op.paddingRight]);
        this.yScale.range([height - op.paddingBottom, op.paddingTop]);
        this.resized.dispatch(width, height);
        this.requestRedraw();
    }
    dispose() {
        if (!this.disposed) {
            this.disposing.dispatch();
            this.disposed = true;
        }
    }
    update() {
        this.updateModel();
        this.updated.dispatch();
    }
    updateModel() {
        var _a, _b;
        for (const s of this.options.series) {
            if (!this.seriesInfo.has(s)) {
                this.seriesInfo.set(s, {
                    yRangeUpdatedIndex: 0,
                });
            }
        }
        const series = this.options.series.filter(s => s.data.length > 0);
        if (series.length === 0) {
            return;
        }
        const opXRange = this.options.xRange;
        const opYRange = this.options.yRange;
        {
            const maxDomain = Math.max(...series.map(s => s.data[s.data.length - 1].x));
            const minDomain = (_b = (_a = this.xRange) === null || _a === void 0 ? void 0 : _a.min) !== null && _b !== void 0 ? _b : Math.min(...series.map(s => s.data[0].x));
            this.xRange = { max: maxDomain, min: minDomain };
            if (this.options.realTime || opXRange === 'auto') {
                if (this.options.realTime) {
                    const currentDomain = this.xScale.domain();
                    const range = currentDomain[1] - currentDomain[0];
                    this.xScale.domain([maxDomain - range, maxDomain]);
                }
                else { // Auto
                    this.xScale.domain([minDomain, maxDomain]);
                }
            }
            else if (opXRange) {
                this.xScale.domain([opXRange.min, opXRange.max]);
            }
        }
        {
            const maxMinY = series.map(s => {
                const newY = s.data.slice(this.seriesInfo.get(s).yRangeUpdatedIndex).map(d => d.y);
                return maxMin(newY);
            });
            if (this.yRange) {
                maxMinY.push(this.yRange);
            }
            const minDomain = Math.min(...maxMinY.map(s => s.min));
            const maxDomain = Math.max(...maxMinY.map(s => s.max));
            this.yRange = { max: maxDomain, min: minDomain };
            if (opYRange === 'auto') {
                this.yScale.domain([minDomain, maxDomain]).nice();
                for (const s of series) {
                    this.seriesInfo.get(s).yRangeUpdatedIndex = s.data.length;
                }
            }
            else if (opYRange) {
                this.yScale.domain([opYRange.min, opYRange.max]);
            }
        }
    }
    requestRedraw() {
        if (this.redrawRequested) {
            return;
        }
        this.redrawRequested = true;
        requestAnimationFrame((time) => {
            this.redrawRequested = false;
            if (!this.disposed) {
                this.update();
            }
        });
    }
    pxPoint(dataPoint) {
        return {
            x: this.xScale(dataPoint.x),
            y: this.yScale(dataPoint.y),
        };
    }
}
//# sourceMappingURL=renderModel.js.map