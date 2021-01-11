import {State} from '../frontend/State'
import {EEG, ATLAS, genBandviewSelect} from '../frontend/EEGInterface'
import {DOMFragment} from '../frontend/DOMFragment'
import {uPlotMaker} from '../utils/eegvisuals'

//You can extend or call this class and set renderProps and these functions
export class uPlotApplet {
    constructor (parentNode=document.getElementById("applets")) { // customize the render props in your constructor
        this.parentNode = parentNode;
        this.AppletHTML = null;

        this.renderProps = {  //Add properties to set and auto-update the HTML
            width: "100px",
            height: "100px",
            id: String(Math.floor(Math.random()*1000000))
        }

        this.class = null;
        this.mode = "uplot";
        this.sub = null;

        this.loop = null;

        this.plotWidth = 500;
        this.plotHeight = 300;
    }

    //----------- default functions, keep and customize these --------

    //Create HTML template string with dynamic properties set in this.renderProps. Updates to these props will cause updates to the template
    HTMLtemplate(props=this.renderProps) {
        return `
        <div id='`+props.id+`'>    
            <div id='`+props.id+`canvas' style='position:absolute;z-index:3;'></div>
            <div id='`+props.id+`menu' style='position:absolute;z-index:4;'>
              <table>
              <tr>
                <td>  
                Graph:
                <select id='`+props.id+`mode'>
                  <option value="FFT" selected="selected">FFTs</option>
                  <option value="Coherence">Coherence</option>
                  <option value="CoherenceTimeSeries">Coherence Time Series</option>
                  <option value="TimeSeries">Raw</option>
                  </select>
                </td>
                <td>
                `+genBandviewSelect(props.id+'bandview')+`
                </td>
                <td>
                <div id='`+props.id+`title' style='font-weight:bold;'>Fast Fourier Transforms</div>
                </td>
              </tr>
              </table>
            </div>
        </div>
        `;
    }

    //Setup javascript functions for the new HTML here
    setupHTML() {
        document.getElementById(this.renderProps.id+"bandview").style.display="none"
        document.getElementById(this.renderProps.id+'mode').onchange = () => {
            this.setuPlot();
            if(document.getElementById(this.renderProps.id+'mode').value==="TimeSeries") {
                if(this.sub !== null){
                    State.unsubscribe('FFTResult',this.sub);
                    this.sub = null;
                    this.updateLoop();
                }
            }
            else { 
                if(this.sub === null) {
                    cancelAnimationFrame(this.loop);
                    this.sub = State.subscribe('FFTResult',this.onUpdate);
                }
            }
            if (document.getElementById(this.renderProps.id+'mode').value === "CoherenceTimeSeries") {
              document.getElementById(this.renderProps.id+"bandview").style.display="";
            }
            else {
              document.getElementById(this.renderProps.id+"bandview").style.display="none";
            }

        }
        document.getElementById(this.renderProps.id+'bandview').onchange = () => {
            if(document.getElementById(this.renderProps.id+'mode').value === "CoherenceTimeSeries"){
                this.setuPlot();
            }
        }
        
    }   

    //Initialize the applet. Keep the first line.
    init() {
        this.AppletHTML = new DOMFragment(this.HTMLtemplate,this.parentNode,this.renderProps,()=>{this.setupHTML()},undefined,"NEVER"); //Changes to this.props will automatically update the html template
        
        this.setPlotDims();
        
        this.class = new uPlotMaker(this.renderProps.id+'canvas');
        //this.setuPlot();
        this.sub = State.subscribe('FFTResult',()=>{try{this.onUpdate();}catch(e){console.error(e);}});
    }

    //Destroy applet. Keep this one line
    deInit() {
        State.unsubscribe('FFTResult',this.sub);
        this.class.deInit();
        this.class = null;
        this.AppletHTML.deleteNode();
    }

    //Callback for when the window resizes. This gets called by the UIManager class to help resize canvases etc.
    onResize() {
        this.setPlotDims();
        this.setuPlot();
    }

    //------------ add new functions below ---------------

    setPlotDims = () => {
        this.plotWidth = this.AppletHTML.node.clientWidth;
        this.plotHeight = this.AppletHTML.node.clientHeight - 30;
    }

    updateLoop = () => {
        this.onUpdate();
        this.requestAnimationFrame(this.updateLoop);
    }

    onUpdate = () => {
      var graphmode = document.getElementById(this.renderProps.id+"mode").value;
      if(graphmode === "FFT"){
          //Animate plot(s)
          this.class.uPlotData = [
              [...ATLAS.fftMap.shared.bandPassWindow]
          ];

          ATLAS.channelTags.forEach((row,i) => {
              if(row.viewing === true) {
                this.class.uPlotData.push([...State.data.FFTResult[i]]);
              }
          });
      }
      else if (graphmode === "Coherence") {
        this.class.uPlotData = [[...ATLAS.coherenceMap.shared.bandPassWindow],...State.data.coherenceResult];
      }
      else if (graphmode === "CoherenceTimeSeries") {
        var band = document.getElementById(this.renderProps.id+"bandview").value
        this.class.uPlotData = [[...ATLAS.coherenceMap.map[0].data.times]];
        ATLAS.coherenceMap.map.forEach((row,i) => {
            this.class.uPlotData.push([...row.data.means[band]]);
        });
      }
      else {
        var nsamples = Math.floor(EEG.sps*State.data.nSecAdcGraph);
        if(nsamples > EEG.data.ms.length) {nsamples = EEG.data.ms.length-1}

        if ((graphmode === "TimeSeries") || (graphmode === "Stacked")) {
            var nsamples = Math.floor(EEG.sps*State.data.nSecAdcGraph);

            this.class.uPlotData = [
                EEG.data.ms.slice(EEG.data.counter - nsamples, EEG.data.counter)
            ];

            ATLAS.channelTags.forEach((row,i) => {
                if(row.viewing === true) {
                this.class.uPlotData.push(EEG.data["A"+row.ch].slice(EEG.data.counter - nsamples, EEG.data.counter));
                }
            });

        }
      }

      //console.log(uPlotData)
      if(graphmode === "Stacked"){
        this.class.makeStackeduPlot(
            undefined,
            this.class.uPlotData,
            undefined,
            ATLAS.channelTags,
            this.plotWidth, 
            this.plotHeight);
      }
      else {
        this.class.plot.setData(this.class.uPlotData);
      }
    }

    setuPlot = () => {
      
        var gmode = document.getElementById(this.renderProps.id+"mode").value;
      
        if(gmode === "TimeSeries"){
          document.getElementById(this.renderProps.id+"title").innerHTML = "ADC signals";
      
          if(EEG.data["A0"].length > 1) {
            var nsamples = Math.floor(EEG.sps*State.data.nSecAdcGraph);
            if(nsamples > EEG.data.ms.length) {nsamples = EEG.data.ms.length-1}
      
            this.class.uPlotData = [
                EEG.data.ms.slice(EEG.data.counter - nsamples, EEG.data.counter)
            ];
      
            ATLAS.channelTags.forEach((row,i) => {
                if(row.viewing === true) {
                  this.class.uPlotData.push(EEG.data["A"+row.ch].slice(EEG.data.counter - nsamples, EEG.data.counter));
                }
            });
            }
          else {
            this.class.uPlotData = [[...ATLAS.fftMap.shared.bandPassWindow]];
            ATLAS.channelTags.forEach((row,i) => {
              this.class.uPlotData.push([...ATLAS.fftMap.shared.bandPassWindow]);
            });
          }
      
          this.class.makeuPlot(
              this.class.makeSeriesFromChannelTags(ATLAS.channelTags), 
              this.class.uPlotData, 
              this.plotWidth, 
              this.plotHeight
            );
          this.class.plot.axes[0].values = (u, vals, space) => vals.map(v => +((v-EEG.data.ms[0])*0.001).toFixed(2) + "s");
      
        }
        else if (gmode === "FFT"){
      
              document.getElementById(this.renderProps.id+"title").innerHTML = "Fast Fourier Transforms";
                //Animate plot(s)
               
              this.class.uPlotData = [
                [...ATLAS.fftMap.shared.bandPassWindow]
              ];
              if((State.data.FFTResult.length > 0) && (State.data.FFTResult.length <= ATLAS.channelTags.length)) {
                //console.log(posFFTList);
                ATLAS.channelTags.forEach((row,i) => {
                  if(i < State.data.FFTResult.length){
                    if(row.viewing === true) {
                      this.class.uPlotData.push([...State.data.FFTResult[i]]);
                    }
                  }
                  else{
                    this.class.uPlotData.push([...ATLAS.fftMap.shared.bandPassWindow]); // Placeholder for unprocessed channel data.
                  }
                });
              }
              else {
                ATLAS.channelTags.forEach((row,i) => {
                  this.class.uPlotData.push([...ATLAS.fftMap.shared.bandPassWindow]);
                });
              }
              this.class.makeuPlot(
                  this.class.makeSeriesFromChannelTags(ATLAS.channelTags), 
                  this.class.uPlotData, 
                  this.plotWidth, 
                  this.plotHeight
                );
        }
        else if (gmode === "Stacked") {
      
          if(EEG.data["A0"].length > 1){
          var nsamples = Math.floor(EEG.sps*State.data.nSecAdcGraph);
          if(nsamples > EEG.data.ms.length) {nsamples = EEG.data.ms.length-1}
      
            this.class.uPlotData = [
                EEG.data.ms.slice(EEG.data.counter - nsamples, EEG.data.counter)
            ];
      
            ATLAS.channelTags.forEach((row,i) => {
                if(row.viewing === true) {
                  this.class.uPlotData.push(EEG.data["A"+row.ch].slice(EEG.data.counter - nsamples, EEG.data.counter));
                }
            });
          }
          else {
            this.class.uPlotData = [[...ATLAS.fftMap.shared.bandPassWindow]];
            ATLAS.channelTags.forEach((row,i) => {
              this.class.uPlotData.push([...ATLAS.fftMap.shared.bandPassWindow]);
            });
          }
      
          document.getElementById(this.renderProps.id+"title").innerHTML = "ADC signals Stacked";
      
          //console.log(uPlotData)
          this.class.makeStackeduPlot(
              undefined, 
              this.class.uPlotData,
              undefined, ATLAS.channelTags,
              this.plotWidth, 
              this.plotHeight
            );
          this.class.plot.axes[0].values = (u, vals, space) => vals.map(v => +(v*0.001).toFixed(2) + "s");
      
        }
        else if (gmode === "Coherence") {
          var newSeries = [{}];
      
          ATLAS.coherenceMap.map.forEach((row,i) => {
            newSeries.push({
              label:row.tag,
              value: (u, v) => v == null ? "-" : v.toFixed(1),
              stroke: "rgb("+Math.random()*255+","+Math.random()*255+","+Math.random()*255+")"
            });
          });

          if((State.data.coherenceResult.length > 0) && (State.data.coherenceResult.length <= ATLAS.coherenceMap.map.length)){
            this.class.uPlotData = [[...ATLAS.fftMap.shared.bandPassWindow],...State.data.coherenceResult];
            if(this.class.uPlotData.length < ATLAS.coherenceMap.map.length+1) {
              for(var i = this.class.uPlotData.length; i < ATLAS.coherenceMap.map.length+1; i++){
                this.class.uPlotData.push([...ATLAS.fftMap.shared.bandPassWindow]);
              }
            }
          }
          else {
            this.class.uPlotData = [[...ATLAS.fftMap.shared.bandPassWindow]];
            ATLAS.channelTags.forEach((row,i) => {
              this.class.uPlotData.push([...ATLAS.fftMap.shared.bandPassWindow]);
            });
          }
          //console.log(newSeries);
          //console.log(uPlotData.length);
          this.class.makeuPlot(
              newSeries, 
              this.class.uPlotData, 
              this.plotWidth, 
              this.plotHeight
            );
          document.getElementById(this.renderProps.id+"title").innerHTML = "Coherence from tagged signals";
        }
        else if (gmode === "CoherenceTimeSeries") {
          var band = document.getElementById(this.renderProps.id+"bandview").value;
          this.class.uPlotData = [[...ATLAS.coherenceMap.map[0].data.times]];
          var newSeries = [{}];
          ATLAS.coherenceMap.map.forEach((row,i) => {
            newSeries.push({
              label:row.tag,
              value: (u, v) => v == null ? "-" : v.toFixed(1),
              stroke: "rgb("+Math.random()*255+","+Math.random()*255+","+Math.random()*255+")"
            });
            this.class.uPlotData.push([...row.data.means[band]]);
          });
          //console.log(this.class.uPlotData)
          this.class.makeuPlot(
              newSeries, 
              this.class.uPlotData, 
              this.plotWidth, 
              this.plotHeight
            );
          document.getElementById(this.renderProps.id+"title").innerHTML = "Mean Coherence over time";
          this.class.plot.axes[0].values = (u, vals, space) => vals.map(v => +(v*0.001).toFixed(2) + "s");
        }
        //else if(graphmode === "StackedRaw") { graphmode = "StackedFFT" }//Stacked Coherence
      }

}