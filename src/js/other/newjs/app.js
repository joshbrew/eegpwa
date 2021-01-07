import {ObjectListener} from './ObjectListener'
import {StateManager} from './StateManager'
import {DOMFragment} from './DOMFragment'
import menusvg from '../assets/menu.svg'
import menuxsvg from '../assets/menuX.svg'

/*
TODO:

Responsive visual blocks
Applet structure with my simple state manager implementation

*/




const State = new StateManager();




class UIManager {
    constructor(initUI = () => {}, menuId = "UI", menuheaderId = "menu_header", menudropdownId = "menu_dropdown") {
        this.initUI = initUI;
        this.initUI();
        this.menuNode = document.getElementById(menuId);


        window.addEventListener('resize', ()=>{
            this.responsiveUIUpdate();
        })

        //this.responsiveUIUpdate();
        State.subscribe('uiNodes', this.responsiveUIUpdate); 
    }

    initUI = () => {}

    responsiveUIUpdate(nodes=State.data.uiNodes, headeroffset=90) {
        if(nodes.length === 1) { //1 full view
            nodes[0].AppletHTML.node.style.width = window.innerWidth + "px";
            nodes[0].AppletHTML.node.style.height = window.innerHeight - headeroffset + "px";
            nodes[0].AppletHTML.node.style.top = headeroffset+"px";
        }
        if(nodes.length === 2) { //2 stacked views
            nodes[0].AppletHTML.node.style.width = window.innerWidth + "px";
            nodes[0].AppletHTML.node.style.height = window.innerHeight*.5 - headeroffset + "px";
            nodes[0].AppletHTML.node.style.top = headeroffset+"px";
            nodes[1].AppletHTML.node.style.width = window.innerWidth + "px";
            nodes[1].AppletHTML.node.style.height = window.innerHeight*.5 - headeroffset + "px";
            var transformy = window.innerHeight*.5+headeroffset;
            nodes[1].AppletHTML.node.style.top = transformy+"px";
        }
        if(nodes.length === 3) {
            nodes[0].AppletHTML.node.style.width = window.innerWidth*.5 + "px";
            nodes[0].AppletHTML.node.style.height = window.innerHeight*.5 - headeroffset + "px";
            nodes[0].AppletHTML.node.style.top = headeroffset+"px";
            nodes[1].AppletHTML.node.style.width = window.innerWidth*.5 + "px";
            nodes[1].AppletHTML.node.style.height = window.innerHeight*.5 - headeroffset + "px";
            nodes[1].AppletHTML.node.style.top = headeroffset+"px";
            nodes[1].AppletHTML.node.style.left = window.innerWidth*.5;
            var transformy = window.innerHeight*.5+headeroffset;
            nodes[2].AppletHTML.node.style.width = window.innerWidth + "px";
            nodes[2].AppletHTML.node.style.height = window.innerHeight*.5-headeroffset + "px";
            nodes[2].AppletHTML.node.style.top = transformy+"px";
        }
        if(nodes.length === 4) {
            nodes[0].AppletHTML.node.style.width = window.innerWidth*.5 + "px";
            nodes[0].AppletHTML.node.style.height = window.innerHeight*.5 - headeroffset + "px";
            nodes[0].AppletHTML.node.style.top = headeroffset+"px";
            nodes[1].AppletHTML.node.style.width = window.innerWidth*.5 + "px";
            nodes[1].AppletHTML.node.style.height = window.innerHeight*.5 - headeroffset + "px";
            nodes[1].AppletHTML.node.style.top = headeroffset+"px";
            nodes[1].AppletHTML.node.style.left = window.innerWidth*.5;
            var transformy = window.innerHeight*.5+headeroffset;
            nodes[2].AppletHTML.node.style.width = window.innerWidth*.5 + "px";
            nodes[2].AppletHTML.node.style.height = window.innerHeight*.5-headeroffset + "px";
            nodes[2].AppletHTML.node.style.top = transformy+"px";
            nodes[3].AppletHTML.node.style.width = window.innerWidth*.5 + "px";
            nodes[3].AppletHTML.node.style.height = window.innerHeight*.5-headeroffset + "px";
            nodes[3].AppletHTML.node.style.top = transformy+"px";
            nodes[3].AppletHTML.node.style.left = window.innerWidth*.5;
        }
        if(nodes.length === 5) {
        }
        if(nodes.length === 6) {
        }
    }
}

function menu_template(props={}) {
    return `
    <table id="UI" style="width:100%; left:0px; top:0px; position:absolute; z-index:10;">
        <tr id="menu_header" style="height:80px; text-align:center;">
        </tr>
        <tr id="menu_dropdown" style="height:400px;">
        </tr>
    </table>`;
}

function menuheader_template(props={}) {
    return `
    <td id="connect" ><button id="connectbutton" style="height:40px; width:40px;"><span>
        <svg  xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" version="1.1" style="fill:black; shape-rendering:geometricPrecision;text-rendering:geometricPrecision;image-rendering:optimizeQuality; position:absolute;  height:40px;width:40px; top:30px; transform:translate(-17px,-3px);" viewBox="0 0 846.66 1058.325" x="0px" y="0px" fill-rule="evenodd" clip-rule="evenodd"><defs><style type="text/css">
            .fil0 {fill-rule:nonzero}
        </style></defs><g><path id="usbico" class="fil0" d="M505.77 220.08l0 118.41 -51.96 0 0 -66.44 -250.68 0 0 422.23 75.51 75.51 168.21 0 0 51.96 -189.73 0 -105.95 -105.95 0 -495.72 53.45 0 0 -195.15 247.71 0 0 195.15 53.44 0zm59.53 481.86c27.37,5.82 47.9,30.15 47.9,59.24 0,33.46 -27.12,60.57 -60.58,60.57 -33.45,0 -60.56,-27.11 -60.56,-60.57 0,-29.09 20.52,-53.42 47.88,-59.24l0 -43.04c-4.32,-2.13 -8.94,-4.34 -13.47,-6.51 -40.22,-19.18 -76.77,-36.63 -76.77,-86.97l0 -20.87c-11.03,-4.87 -18.7,-15.87 -18.7,-28.69 0,-17.32 14.05,-31.37 31.37,-31.37 17.33,0 31.38,14.05 31.38,31.37 0,12.82 -7.7,23.82 -18.7,28.69l0 20.87c0,34.38 29.67,48.52 62.3,64.09l2.59 1.25 0 -266.72 -28.96 0 41.64 -65.85 41.65 65.85 -28.97 0 0 216.08 8.35 -4 0 -0.05c42.78,-20.41 81.66,-38.97 81.66,-85.12l0 -47.87 -14.84 0 0 -55.03 55.03 0 0 55.03 -14.84 0 0 47.87c0,62.14 -45.76,83.98 -96.12,108l-0.02 -0.04c-6.25,2.98 -12.58,5.98 -19.22,9.31l0 93.72zm-221.33 -578.46l41.35 0 0 41.35 -41.35 0 0 -41.35zm-72.35 0l41.35 0 0 41.35 -41.35 0 0 -41.35zm-32.37 96.6l178.44 0 0 -160.52 -178.44 0 0 160.52z"/></g><text x="0" y="861.66" fill="#000000" font-size="5px" font-weight="bold" font-family="'Helvetica Neue', Helvetica, Arial-Unicode, Arial, Sans-serif">Created by callorine</text><text x="0" y="866.66" fill="#000000" font-size="5px" font-weight="bold" font-family="'Helvetica Neue', Helvetica, Arial-Unicode, Arial, Sans-serif">from the Noun Project</text></svg>
        </span>&nbsp;
        </button>
    </td>
    <td id="run" style="width:5%;"><button id="runbutton" style="height:40px; width:40px; transform:rotate(90deg); font-size: 30px;"><div style=transform:translate(-2px,0px);>▲</div></button></td>
    <td id="stop" style="width:5%;"><button id="stopbutton" style="height:40px; width:40px; font-size:35px;"><div style=transform:translate(0px,-6px);>■</div></button></td>
    <td id="menu" style="width:80%;"> 
        <div style="float:right; margin-right: 80px;">
        <img id="menusvg" src=`+menusvg+` style="position:absolute; height:60px;width:60px; top:12.5px;"/>   
        <img id="menuxsvg" src=`+menuxsvg+` style="position:absolute; height:60px;width:60px; top:12.5px; display:none; opacity:0;"/>
        <input style="display:none;" type="checkbox" id="menucheckbox" title="Menu">
        </div>
    </td>
    `;
}

function menudropdown_template(props={}) {
    return `
    <td style="width:100%; vertical-align:top; border:2px inset black;" colspan=4>
        <table style="margin-left:auto; margin-right:auto; ">
            <tr><td>Set Bandpass</td><td><input type="text" style="width:95%;" id="freqStart" placeholder="0 (Hz)"></td><td>to</td><td><input type="text" style="width:100%;" id="freqEnd" placeholder="256 (Hz)"></td><td><button id="setBandpass">Set</button></td></tr>
            <tr><td>Set Channel View</td><td colspan=3><input type="text" style="width:100%;" id="View" placeholder=""></input></td><td><button id="setView">Set</button></td></tr>
            <tr><td>Set Tags</td><td colspan=3><input type="text" style="width:100%;" id="Tags" placeholder=""></input></td><td><button id="setTags">Set</button></td></tr>
        </table>
     </td>`;
}

function menu_setup() {
    document.getElementById("menuxsvg").style.display = "none";
    
    document.getElementById("menusvg").onclick = () => {

      document.getElementById("menucheckbox").click();

      document.getElementById("menusvg").style.opacity = 0;
      document.getElementById("menuxsvg").style.display = "";
      
      setTimeout(() => { 
        document.getElementById("menuxsvg").style.opacity = 1; 
        document.getElementById("menusvg").style.display = "none";  
      }, 300);

     }
     
     document.getElementById("menuxsvg").onclick = () => {

      document.getElementById("menucheckbox").click();

      document.getElementById("menusvg").style.display = "";
      document.getElementById("menuxsvg").style.opacity = 0;

      setTimeout(() => {  
        document.getElementById("menusvg").style.opacity = 1;  
        document.getElementById("menuxsvg").style.display = "none"; 
      }, 300);
     }

     document.getElementById("menucheckbox").onchange = () => {

      if(document.getElementById("menucheckbox").checked === true){
        document.getElementById("menu_dropdown").style.opacity = 1;
        document.getElementById("menu_dropdown").style.transform = "translateY(0px)";
        document.getElementById("menu_dropdown").style.transition ="transform 0.5s ease-in-out, opacity 0.4s ease 0.3s";
        document.getElementById("UI").style.zIndex = 999;
      }
      else {
        document.getElementById("menu_dropdown").style.opacity = 0;
        document.getElementById("menu_dropdown").style.transform = "translateY(-500px)";
        document.getElementById("menu_dropdown").style.transition ="transform 0.5s ease-in-out, opacity 0.1s ease";
        document.getElementById("UI").style.zIndex = 10;
      }
     }

     document.getElementById("connectbutton").onclick = () => {
       if(document.getElementById("usbico").style.fill !== "orange") {document.getElementById("usbico").style.fill = "orange";}
       else{ document.getElementById("usbico").style.fill = "black"; }
     }

}


class AppletExample {
    constructor(parentNode) {
        this.parentNode = parentNode;
        this.AppletHTML = null;

        this.renderProps = { //changes to this will auto update the HTML
            width: "100px",
            height: "100px",
            id: String(Math.floor(Math.random()*1000000))
        };

        State.data.x = 0;
        this.subscription = State.subscribe('x',this.doSomething);
        //this.listener = new ObjectListener();

    }

    HTMLtemplate(props=this.renderProps) { //Simply use a template string of the desired HTML to be rendered
        return `
            <div id='`+props.id+`' style='z-index:20; position:absolute; height:`+props.height+`;width:`+props.width+`'>
                <div id='`+props.id+`x'>`+State.data.x+`</div>
                <button id='`+props.id+`button1'>+</button>
                <canvas id='`+props.id+`canvas' style='height:`+props.height+`;width:`+props.width+`;'></canvas>
            </div>
        `;
    }

    setupHTML(){
        //Apply onclick functions and stuff after initializing the DOMFragment
        document.getElementById(this.renderProps.id+"button1").onclick = () => {
            State.setState({x:State.data.x+1});
        }
    }

    doSomething = () => {
        document.getElementById(this.renderProps.id+"x").innerHTML=State.data.x;
        console.log(State.data.x);
    }

    init() {
        this.AppletHTML = new DOMFragment(this.HTMLtemplate,this.parentNode,this.renderProps); //Changes to this.props will automatically update the html template
        this.setupHTML();
    }

    deInit() {
        State.unsubscribe('x',this.subscription);
        this.AppletHTML.deleteNode();
    }

    onResize() {
        var canvas = document.getElementById(this.renderProps.id+"canvas");
        canvas.width = this.renderProps.width;
        canvas.height = this.renderProps.height;
    }
}



State.data.uiNodes = [new AppletExample(document.body)];


function initUI() {
    var menunode = new DOMFragment(menu_template,document.body);
    var menuheader = new DOMFragment(menuheader_template,"menu_header");
    var menudropdown = new DOMFragment(menudropdown_template,"menu_dropdown");
    menu_setup();
}
const UI = new UIManager(initUI);

State.data.uiNodes[0].init();
UI.responsiveUIUpdate();
//TODO: Organize UI Nodes inside container