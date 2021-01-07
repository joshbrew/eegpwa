import {State} from './State'


export class UIManager {
    constructor(initUI = () => {}, deInitUI = () => {}, menuId = "UI", menuheaderId = "menu_header", menudropdownId = "menu_dropdown") {
        this.initUI = initUI;
        this.deInitUI = deInitUI;
        this.initUI();
        
        this.menuNode = document.getElementById(menuId);

        State.data.appletClasses.forEach((classObj,i) => {
            if(i < 4) {
                State.data.applets.push(new classObj("applets"));
                State.data.applets[i].init();
            }
        })

        console.log(State.data.applets)

        State.data.applets.forEach((applet,i) => {
            applet.AppletHTML.node.style.position = "absolute";
        });

        window.addEventListener('resize', ()=>{
            this.responsiveUIUpdate();
        })

        //this.responsiveUIUpdate();
        State.subscribe('applets', this.responsiveUIUpdate); 
    }

    initUI = () => {}

    deInitUI = () => {}

    responsiveUIUpdate(nodes=State.data.applets, topoffset=0) {
        if(nodes.length === 1) { //1 full view
            nodes[0].AppletHTML.node.style.width = window.innerWidth + "px";
            nodes[0].AppletHTML.node.style.height = window.innerHeight - topoffset + "px";
            nodes[0].AppletHTML.node.style.top = topoffset+"px";
        }
        if(nodes.length === 2) { //2 stacked views
            nodes[0].AppletHTML.node.style.width = window.innerWidth + "px";
            nodes[0].AppletHTML.node.style.height = window.innerHeight*.5 - topoffset + "px";
            nodes[0].AppletHTML.node.style.top = topoffset+"px";
            nodes[1].AppletHTML.node.style.width = window.innerWidth + "px";
            nodes[1].AppletHTML.node.style.height = window.innerHeight*.5 - topoffset + "px";
            var transformy = window.innerHeight*.5+topoffset;
            nodes[1].AppletHTML.node.style.top = transformy+"px";
        }
        if(nodes.length === 3) {
            nodes[0].AppletHTML.node.style.width = window.innerWidth*.5 + "px";
            nodes[0].AppletHTML.node.style.height = window.innerHeight*.5 - topoffset + "px";
            nodes[0].AppletHTML.node.style.top = topoffset+"px";
            nodes[1].AppletHTML.node.style.width = window.innerWidth*.5 + "px";
            nodes[1].AppletHTML.node.style.height = window.innerHeight*.5 - topoffset + "px";
            nodes[1].AppletHTML.node.style.top = topoffset+"px";
            nodes[1].AppletHTML.node.style.left = window.innerWidth*.5;
            var transformy = window.innerHeight*.5+topoffset;
            nodes[2].AppletHTML.node.style.width = window.innerWidth + "px";
            nodes[2].AppletHTML.node.style.height = window.innerHeight*.5-topoffset + "px";
            nodes[2].AppletHTML.node.style.top = transformy+"px";
        }
        if(nodes.length === 4) {
            nodes[0].AppletHTML.node.style.width = window.innerWidth*.5 + "px";
            nodes[0].AppletHTML.node.style.height = window.innerHeight*.5 - topoffset + "px";
            nodes[0].AppletHTML.node.style.top = topoffset+"px";
            nodes[1].AppletHTML.node.style.width = window.innerWidth*.5 + "px";
            nodes[1].AppletHTML.node.style.height = window.innerHeight*.5 - topoffset + "px";
            nodes[1].AppletHTML.node.style.top = topoffset+"px";
            nodes[1].AppletHTML.node.style.left = window.innerWidth*.5;
            var transformy = window.innerHeight*.5+topoffset;
            nodes[2].AppletHTML.node.style.width = window.innerWidth*.5 + "px";
            nodes[2].AppletHTML.node.style.height = window.innerHeight*.5-topoffset + "px";
            nodes[2].AppletHTML.node.style.top = transformy+"px";
            nodes[3].AppletHTML.node.style.width = window.innerWidth*.5 + "px";
            nodes[3].AppletHTML.node.style.height = window.innerHeight*.5-topoffset + "px";
            nodes[3].AppletHTML.node.style.top = transformy+"px";
            nodes[3].AppletHTML.node.style.left = window.innerWidth*.5;
        }
        if(nodes.length === 5) {
        }
        if(nodes.length === 6) {
        }

        State.data.applets.forEach((applet,i) => {
            applet.onResize();
        });
    }
}