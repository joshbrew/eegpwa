import {State} from '../frontend/State'
import {EEG, ATLAS, genBandviewSelect} from '../frontend/EEGInterface'
import {BrainMap2D} from '../utils/eegvisuals'
import {DOMFragment} from '../utils/DOMFragment'

//You can extend or call this class and set renderProps and these functions
export class BrainMapApplet {
    constructor (parentNode=document.getElementById("applets")) { // customize the render props in your constructor
        this.parentNode = parentNode;
        this.AppletHTML = null;

        this.renderProps = {  //Add properties to set and auto-update the HTML
            width: "300px",
            height: "300px",
            id: String(Math.floor(Math.random()*1000000))
        }

        this.class = null;
        this.mode = "brainmap";
        this.sub = null;
    }

    //----------- default functions, keep and customize these --------

    //Create HTML template string with dynamic properties set in this.renderProps. Updates to these props will cause updates to the template
    HTMLtemplate(props=this.renderProps) {
        return `
        <div id='`+props.id+`'>
            <canvas id='`+props.id+`canvas' width='`+props.width+`' height='`+props.height+`' style='position:absolute; width:`+props.width+`px; height:`+props.height+`px; z-index:1; transform:translateY(-200px);'></canvas>
            <canvas id='`+props.id+`points' width='`+props.width+`' height='`+props.height+`' style='position:absolute; width:`+props.width+`px; height:`+props.height+`px; z-index:2; transform:translateY(-200px);'></canvas>
            <table id='`+props.id+`table' style='position:absolute; z-index:3; transform:translateY(-200px);'>
            <tr><td><h3>Brain Map</h3></td>
            <td><h4>Viewing:</h4></td>
            <td>`+genBandviewSelect(props.id+'bandview')+`</td></tr>
            </table>
        </div>
        `;
    }

    //Setup javascript functions for the new HTML here
    setupHTML() {
        this.class = new BrainMap2D(this.renderProps.id+'canvas',this.renderProps.id+'points');
        document.getElementById(this.renderProps.id+'bandview').onchange = () => {
            this.setBrainMap();
        }
    }

    //Initialize the applet. Keep the first line.
    init() {
        this.AppletHTML = new DOMFragment(this.HTMLtemplate,this.parentNode,this.renderProps,()=>{this.setupHTML()},undefined,"NEVER"); //Changes to this.props will automatically update the html template
        this.class.genHeatMap();
        this.class.points = [];
        ATLAS.fftMap.forEach((row,i) => {
            this.class.points.push({x:row.data.x*1.5+200, y:200-row.data.y*1.5, size:130, intensity:0.8});
        });
        this.class.updateHeatmap();
        this.class.updatePointsFromAtlas(EEG.atlas,EEG.channelTags);

        this.sub = State.subscribe('FFTResult', this.onUpdate);
    }

    //Destroy applet. Keep this one line
    deInit() {
        State.unsubscribe('FFTResult', this.sub);
        this.class.deInit();
        this.class = null;
        this.AppletHTML.deleteNode();
    }

    //Callback for when the window resizes. This gets called by the UIManager class to help resize canvases etc.
    onResize() {
        var brainmapcanvas = document.getElementById(this.renderProps.id+'canvas');
        var brainpointscanvas = document.getElementById(this.renderProps.id+'points');
        brainmapcanvas.style.height = this.AppletHTML.node.style.height;
        brainmapcanvas.style.width = brainmapcanvas.style.height;
        brainpointscanvas.style.height = this.AppletHTML.node.style.height;
        brainpointscanvas.style.width = brainpointscanvas.style.height;
    }

    //------------ add new functions below ---------------

    onUpdate = () => {
        var viewing = document.getElementById(this.renderProps.id+"bandview").value;
        this.class.updateHeatmapFromAtlas(ATLAS.fftMap,ATLAS.channelTags,viewing);

        if(State.data.coherenceResults.length === ATLAS.coherenceMap.map.length){
            this.class.updateConnectomeFromAtlas(ATLAS.coherenceMap,ATLAS.fftMap,ATLAS.channelTags,viewing);
        }
    }

    setBrainMap = () => {
        var viewing = document.getElementById(this.renderProps.id+"bandview");
        this.class.updatePointsFromAtlas(ATLAS.fftMap,ATLAS.channelTags);
        this.class.updateHeatmapFromAtlas(ATLAS.fftMap,ATLAS.channelTags,viewing);
        this.class.updateConnectomeFromAtlas(ATLAS.coherenceMap,ATLAS.fftMap,ATLAS.channelTags,viewing);
    }

}