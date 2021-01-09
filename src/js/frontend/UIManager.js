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
              newhtml += `<option value='`+cls.name+`' selected="selected">`+State.data.appletNames[i]+`</option>`;
            }
            else{
              newhtml += `<option value='`+cls.name+`'>`+State.data.appletNames[i]+`</option>`;
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
        //console.log(nodes);
        nodes.forEach((node,i) => {
            
            //TODO: replace this with something more procedural for n-elements with varied arrangements 
            //(e.g. arbitrary sizes and arrangements for applets. This is why we didn't use tables to place the apps.)
            
            if(nodes.length === 1) { //1 full view
                if(node.appletIdx === 1){
                    node.classinstance.AppletHTML.node.style.width = window.innerWidth + "px";
                    node.classinstance.AppletHTML.node.style.height = window.innerHeight - topoffset + "px";
                }
            }
            if(nodes.length === 2) { //2 stacked views
                var transformy = window.innerHeight*.5- topoffset;
                if(node.appletIdx === 1){
                    node.classinstance.AppletHTML.node.style.width = window.innerWidth + "px";
                    node.classinstance.AppletHTML.node.style.height = window.innerHeight*.5 - topoffset + "px";
                }
                else if(node.appletIdx === 2){
                    node.classinstance.AppletHTML.node.style.width = window.innerWidth + "px";
                    node.classinstance.AppletHTML.node.style.height = window.innerHeight*.5 - topoffset + "px";
                    node.classinstance.AppletHTML.node.style.top = transformy+"px";
                }
            }
            if(nodes.length === 3) {
                var transformy = window.innerHeight*.5- topoffset;
                if(node.appletIdx === 1){
                    node.classinstance.AppletHTML.node.style.width = window.innerWidth*.5 + "px";
                    node.classinstance.AppletHTML.node.style.height = window.innerHeight*.5 - topoffset + "px";
                }
                else if(node.appletIdx === 2){
                    node.classinstance.AppletHTML.node.style.width = window.innerWidth*.5 + "px";
                    node.classinstance.AppletHTML.node.style.height = window.innerHeight*.5 - topoffset + "px";
                    node.classinstance.AppletHTML.node.style.left = window.innerWidth*.5;
                }
                else if(node.appletIdx === 3){
                    node.classinstance.AppletHTML.node.style.width = window.innerWidth + "px";
                    node.classinstance.AppletHTML.node.style.height = window.innerHeight*.5-topoffset + "px";
                    node.classinstance.AppletHTML.node.style.top = transformy+"px";
                }
            }
            if(nodes.length === 4) {
                var transformy = window.innerHeight*.5- topoffset;
                if(node.appletIdx === 1){
                    node.classinstance.AppletHTML.node.style.width = window.innerWidth*.5 + "px";
                    node.classinstance.AppletHTML.node.style.height = window.innerHeight*.5 - topoffset + "px";
                }
                else if(node.appletIdx === 2){
                    node.classinstance.AppletHTML.node.style.width = window.innerWidth*.5 + "px";
                    node.classinstance.AppletHTML.node.style.height = window.innerHeight*.5 - topoffset + "px";
                    node.classinstance.AppletHTML.node.style.left = window.innerWidth*.5+"px";
                }
                else if(node.appletIdx === 3){
                    node.classinstance.AppletHTML.node.style.width = window.innerWidth*.5 + "px";
                    node.classinstance.AppletHTML.node.style.height = window.innerHeight*.5-topoffset + "px";
                    node.classinstance.AppletHTML.node.style.top = transformy+"px";
                }
                else if(node.appletIdx === 4){
                    node.classinstance.AppletHTML.node.style.width = window.innerWidth*.5 + "px";
                    node.classinstance.AppletHTML.node.style.height = window.innerHeight*.5-topoffset + "px";
                    node.classinstance.AppletHTML.node.style.top = transformy+"px";
                    node.classinstance.AppletHTML.node.style.left = window.innerWidth*.5+"px";
                }
            }
            if(nodes.length === 5) {
            }
            if(nodes.length === 6) {
            }
        });
        

        State.data.applets.forEach((applet,i) => {
            applet.classinstance.onResize();
        });
    }
}