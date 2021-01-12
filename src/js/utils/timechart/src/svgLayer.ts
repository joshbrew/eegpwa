import { ResolvedRenderOptions } from './options';
import { RenderModel } from './renderModel';

export class SVGLayer {
    svgNode: SVGSVGElement;

    constructor(el: HTMLElement, model: RenderModel) {
        this.svgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const style = this.svgNode.style;
        style.position = 'absolute';
        style.width = style.height = '100%';
        style.left = style.right = style.top = style.bottom = '0';
        el.shadowRoot!.appendChild(this.svgNode);

        model.disposing.on(() => {
            el.shadowRoot!.removeChild(this.svgNode);
        })
    }
}

export function makeContentBox(model: RenderModel, options: ResolvedRenderOptions) {
    const contentSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    contentSvg.classList.add('content-box')
    contentSvg.x.baseVal.value = options.paddingLeft
    contentSvg.y.baseVal.value = options.paddingRight

    model.resized.on((width, height) => {
        contentSvg.width.baseVal.value = width - options.paddingRight - options.paddingLeft;
        contentSvg.height.baseVal.value = height - options.paddingTop - options.paddingBottom;
    })
    return contentSvg;
}
