import {State} from './State'


export class UIManager {
    constructor(initUI = () => {}, deInitUI = () => {}, appletSelectIds=["applet1","applet2","applet3","applet4"], menuId = "UI", menuheaderId = "menu_header", menudropdownId = "menu_dropdown") {
        this.initUI = initUI;
        this.deInitUI = deInitUI;
        this.initUI();
        
        this.menuNode = document.getElementById(menuId);
        this.maxApplets = 4;
        this.appletSelectIds = appletSelectIds;

        this.initAddApplets();

        window.addEventListener('resize', ()=>{
            this.responsiveUIUpdate();
        })

        //this.responsiveUIUpdate();
        State.subscribe('appletsSpawned', this.responsiveUIUpdate); 
    
        appletSelectIds.forEach((id,i) => {
            this.addAppletOptions(id,i+1);
        })

    }

    initUI = () => {}

    deInitUI = () => {}

    initAddApplets = () => {
        if(State.data.appletsSpawned < this.maxApplets) {
            State.data.appletClasses.forEach((classObj,i) => {
                if(State.data.appletsSpawned < this.maxApplets) {
                    State.data.applets.push({ appletIdx:i+1, classinstance:new classObj("applets")});
                    State.data.appletsSpawned++;
                }
            });
        }

        this.initApplets();

    }

    initApplets = () => {
        State.data.applets.forEach((applet,i) => {
            if(applet.classinstance.AppletHTML === null) { applet.classinstance.init(); }
            applet.classinstance.AppletHTML.node.style.position = "absolute";
        });
    }

    addApplet = (appletClassIdx, appletIdx) => {
        var classObj = State.data.appletClasses[appletClassIdx];
        var found = State.data.applets.find((o,i) => {
            if(o.appletIdx === appletIdx) {
                this.deInitApplet(appletIdx)
                return true;
            }
        })
        State.data.applets.push({appletIdx:appletIdx, classinstance: new classObj("applets")});
        State.data.applets[State.data.applets.length-1].classinstance.init();
        State.data.applets[State.data.applets.length-1].classinstance.AppletHTML.node.style.position = "absolute";
        State.data.appletsSpawned++;
    }

    initApplet = (appletIdx) => {
        State.data.applets[appletIdx].classinstance.init();
        State.data.applets[appletIdx].classinstance.AppletHTML.node.style.position = "absolute";
    }

    deInitApplet = (appletIdx) => {
        var stateIdx = null;
        var found = State.data.applets.find((o,i) => {
            if(o.appletIdx === appletIdx) {
                console.log(o);
                stateIdx = i;
                return true;
            }
        });
        if(stateIdx !== null){
            State.data.applets[stateIdx].classinstance.deInit();
            State.data.applets.splice(stateIdx,1);
            State.data.appletsSpawned--;
        }
    }

    addAppletOptions = (selectId,appletIdx) => {
        var select = document.getElementById(selectId);
        select.innerHTML = "";
        var newhtml = `<option value='None'>None</option>`;
        var stateIdx = 0;
        var found = State.data.applets.find((o,i) => {
            if(o.appletIdx === appletIdx) {
                stateIdx = i;
                return true;
            }
        });
        State.data.appletClasses.forEach((cls,i) => {
            if(State.data.applets[stateIdx].classinstance.constructor.name===cls.name) {
              newhtml += `<option value='`+cls.name+`' selected="selected">`+cls.name+`</option>`;
            }
            else{
              newhtml += `<option value='`+cls.name+`'>`+cls.name+`</option>`;
            }
        });
        select.innerHTML = newhtml;

        select.addEventListener('change', ()=>{
            this.deInitApplet(appletIdx);
            if(select.value !== 'None'){
                let found = State.data.appletClasses.find((o,i)=>{
                    if(o.name===select.value){
                        this.addApplet(i,appletIdx);
                        return true;
                    }
                });
            }
        })
    }

    responsiveUIUpdate(nodes=State.data.applets, topoffset=90) {
        console.log(nodes);
        if(nodes.length === 1) { //1 full view
            nodes[0].classinstance.AppletHTML.node.style.width = window.innerWidth + "px";
            nodes[0].classinstance.AppletHTML.node.style.height = window.innerHeight - topoffset + "px";
        }
        if(nodes.length === 2) { //2 stacked views
            nodes[0].classinstance.AppletHTML.node.style.width = window.innerWidth + "px";
            nodes[0].classinstance.AppletHTML.node.style.height = window.innerHeight*.5 - topoffset + "px";
            nodes[1].classinstance.AppletHTML.node.style.width = window.innerWidth + "px";
            nodes[1].classinstance.AppletHTML.node.style.height = window.innerHeight*.5 - topoffset + "px";
            var transformy = window.innerHeight*.5- topoffset;
            nodes[1].classinstance.AppletHTML.node.style.top = transformy+"px";
            
        }
        if(nodes.length === 3) {
            nodes[0].classinstance.AppletHTML.node.style.width = window.innerWidth*.5 + "px";
            nodes[0].classinstance.AppletHTML.node.style.height = window.innerHeight*.5 - topoffset + "px";
            nodes[1].classinstance.AppletHTML.node.style.width = window.innerWidth*.5 + "px";
            nodes[1].classinstance.AppletHTML.node.style.height = window.innerHeight*.5 - topoffset + "px";
            nodes[1].classinstance.AppletHTML.node.style.left = window.innerWidth*.5;
            var transformy = window.innerHeight*.5 - topoffset;
            nodes[2].classinstance.AppletHTML.node.style.width = window.innerWidth + "px";
            nodes[2].classinstance.AppletHTML.node.style.height = window.innerHeight*.5-topoffset + "px";
            nodes[2].classinstance.AppletHTML.node.style.top = transformy+"px";
        }
        if(nodes.length === 4) {
            nodes[0].classinstance.AppletHTML.node.style.width = window.innerWidth*.5 + "px";
            nodes[0].classinstance.AppletHTML.node.style.height = window.innerHeight*.5 - topoffset + "px";
            nodes[1].classinstance.AppletHTML.node.style.width = window.innerWidth*.5 + "px";
            nodes[1].classinstance.AppletHTML.node.style.height = window.innerHeight*.5 - topoffset + "px";
            nodes[1].classinstance.AppletHTML.node.style.left = window.innerWidth*.5+"px";
            var transformy = window.innerHeight*.5- topoffset;
            nodes[2].classinstance.AppletHTML.node.style.width = window.innerWidth*.5 + "px";
            nodes[2].classinstance.AppletHTML.node.style.height = window.innerHeight*.5-topoffset + "px";
            nodes[2].classinstance.AppletHTML.node.style.top = transformy+"px";
            nodes[3].classinstance.AppletHTML.node.style.width = window.innerWidth*.5 + "px";
            nodes[3].classinstance.AppletHTML.node.style.height = window.innerHeight*.5-topoffset + "px";
            nodes[3].classinstance.AppletHTML.node.style.top = transformy+"px";
            nodes[3].classinstance.AppletHTML.node.style.left = window.innerWidth*.5+"px";
        }
        if(nodes.length === 5) {
        }
        if(nodes.length === 6) {
        }

        State.data.applets.forEach((applet,i) => {
            applet.classinstance.onResize();
        });
    }
}