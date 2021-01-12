import { resolveColorRGBA, ResolvedRenderOptions } from './options';
import { RenderModel } from './renderModel';

function getContext(canvas: HTMLCanvasElement, forceWebGL1: boolean) {
    if (!forceWebGL1) {
        const ctx = canvas.getContext('webgl2');
        if (ctx) {
            return ctx;
        }
    }
    const ctx = canvas.getContext('webgl');
    if (ctx) {
        return ctx;
    }
    throw new Error('Unable to initialize WebGL. Your browser or machine may not support it.');
}

export class CanvasLayer {
    canvas: HTMLCanvasElement
    gl: WebGL2RenderingContext | WebGLRenderingContext;

    constructor(el: HTMLElement, private options: ResolvedRenderOptions, model: RenderModel) {
        const canvas = document.createElement('canvas');
        const style = canvas.style;
        style.position = 'absolute';
        style.width = style.height = '100%';
        style.left = style.right = style.top = style.bottom = '0';
        el.shadowRoot!.appendChild(canvas);

        this.gl = getContext(canvas, options.forceWebGL1);

        const bgColor = resolveColorRGBA(options.backgroundColor);
        this.gl.clearColor(...bgColor);

        this.canvas = canvas;

        model.updated.on(() => this.clear());
        model.resized.on((w, h) => this.onResize(w, h));
        model.disposing.on(() => {
            el.shadowRoot!.removeChild(canvas);
            canvas.width = 0;
            canvas.height = 0;
            const lossContext = this.gl.getExtension('WEBGL_lose_context');
            if (lossContext) {
                lossContext.loseContext();
            }
        })
    }

    onResize(width: number, height: number) {
        const canvas = this.canvas;
        const scale = this.options.pixelRatio;
        canvas.width = width * scale;
        canvas.height = height * scale;
        this.gl.viewport(0, 0, canvas.width, canvas.height);
    }

    clear() {
        const gl = this.gl;
        gl.clear(gl.COLOR_BUFFER_BIT);
    }
}
