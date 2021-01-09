import {State} from '../frontend/State'
import {EEG, ATLAS, addChannelOptions, addCoherenceOptions} from '../frontend/EEGInterface'
import { SmoothieChartMaker } from '../utils/eegvisuals';
import {DOMFragment} from '../utils/DOMFragment'

//You can extend or call this class and set renderProps and these functions
export class SmoothieApplet {
    constructor (parentNode=document.getElementById("applets")) { // customize the render props in your constructor
        this.parentNode = parentNode;
        this.AppletHTML = null;

        this.renderProps = {  //Add properties to set and auto-update the HTML
            width: "400px",
            height: "300px",
            id: String(Math.floor(Math.random()*1000000))
        }

        this.class=null;
        this.mode="smoothie";
        this.sub = null;
    }

    //----------- default functions, keep and customize these --------

    //Create HTML template string with dynamic properties set in this.renderProps. Updates to these props will cause updates to the template
    HTMLtemplate(props=this.renderProps) {
        return `
        <div id='`+props.id+`'>
            <canvas id='`+props.id+`canvas' width=`+props.width+` height=`+props.height+` style='z-index:3; position:absolute; width:`+props.width+`; height:`+props.height+`;'></canvas>
            <div id='`+props.id+`menu' style='position:absolute; z-index:4; color:white;'>
                Mode:
                <select id='`+props.id+`mode'>
                <option value="alpha" selected="selected">Alpha1 Bandpowers</option>
                <option value="coherence">Alpha1 Coherence</option>
                <option value="bandpowers">1Ch All Bandpowers</option>
                </select>
                Channel:
                <select id='`+props.id+`channel'>
                <option value="0">0</option>
                </select>
            </div>
        </div>
        `;
    }

    //Setup javascript functions for the new HTML here
    setupHTML() {
        addChannelOptions(this.renderProps.id+"channel");
        
        /*
        document.getElementById(this.renderProps.id+"mode").onchange = () => {
            if(document.getElementById(this.renderProps.id+"mode").value === "coherence"){
                State.unsubscribe('FFTResult',this.sub);
                this.sub = State.subscribe('coherenceResult',this.onUpdate);
            }
            else{
                State.unsubscribe('coherenceResult',this.sub);
                this.sub = State.subscribe('FFTResult',this.onUpdate);
            }
        }
        */
    }

    //Initialize the applet. Keep the first line.
    init() {
        this.AppletHTML = new DOMFragment(this.HTMLtemplate,this.parentNode,this.renderProps,()=>{this.setupHTML();},undefined,"NEVER"); //Changes to this.props will automatically update the html template
        
        this.class = new SmoothieChartMaker(8, document.getElementById(this.renderProps.id+"canvas"));
        this.class.init('rgba(0,100,100,0.5)');
        
        this.sub = State.subscribe('FFTResult', ()=>{try{this.onUpdate()}catch(e){console.error(e);}});

        document.getElementById("stopbutton").addEventListener('click',this.stopEvent);
        document.getElementById("runbutton").addEventListener('click',this.startEvent);
    }

    //Destroy applet. Keep this one line
    deInit() {
        this.class.deInit();
        this.AppletHTML.deleteNode();
        this.class = null;

        document.getElementById("stopbutton").removeEventListener('click',this.stopEvent);
        document.getElementById("runbutton").addEventListener('click',this.stopEvent);
    }

    //Callback for when the window resizes. This gets called by the UIManager class to help resize canvases etc.
    onResize() {
       this.class.canvas.style.height = this.AppletHTML.node.style.height;
       this.class.canvas.style.width = this.AppletHTML.node.style.width;
    }

    //------------ add new functions below ---------------

    onUpdate = () => {
      var graphmode = document.getElementById(this.renderProps.id+"mode").value;
      if((graphmode === "alpha") || (graphmode === "bandpowers")) {
        if(graphmode === "alpha"){
            ATLAS.channelTags.forEach((row,i) => {
            var coord = {};
            coord = ATLAS.getAtlasCoordByTag(row.tag);

            if(i < this.class.series.length - 1){
              this.class.series[i].append(Date.now(), Math.max(...coord.data.slices.alpha1[coord.data.slices.alpha1.length-1]));
            }
          });
        }
        else if(graphmode === "bandpowers") {
          var ch = document.getElementById(this.renderProps.id+"channel").value;
          var tag = null;
          ATLAS.channelTags.find((o,i) => {
            if(o.ch === ch){
              tag = o.tag;
              return true;
            }
          });
          if(tag !== null){
            var coord = ATLAS.getAtlasCoordByTag(tag);
            this.class.bulkAppend([
              Math.max(...coord.data.slices.delta[coord.data.slices.delta.length-1]),
              Math.max(...coord.data.slices.theta[coord.data.slices.theta.length-1]),
              Math.max(...coord.data.slices.alpha1[coord.data.slices.alpha1.length-1]),
              Math.max(...coord.data.slices.alpha2[coord.data.slices.alpha2.length-1]),
              Math.max(...coord.data.slices.beta[coord.data.slices.beta.length-1]),
              Math.max(...coord.data.slices.lowgamma[coord.data.slices.lowgamma.length-1])
            ]);
          }
        }
      }
      else if (graphmode === "coherence") {
        ATLAS.coherenceMap.map.forEach((row,i) => {
          if(i < this.class.series.length - 1){
            this.class.series[i].append(Date.now(), Math.max(...row.data.slices.alpha1[row.data.slices.alpha1.length-1]));
          }
        });
      }
    }

    stopEvent = () => {
        this.class.chart.stop();
    }

    startEvent = () => {
        this.class.chart.start();
    }

}