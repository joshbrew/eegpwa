import {State} from '../frontend/State'
import {EEG, ATLAS, genBandviewSelect, addChannelOptions, addCoherenceOptions} from '../frontend/EEGInterface'
import {DOMFragment} from '../frontend/DOMFragment'
import {uPlotMaker} from '../utils/visuals/eegvisuals'
import {eegmath} from '../utils/eeg32'

/*
TODO:
Custom plot legend, still clickable but much more compact.
*/

//You can extend or call this class and set renderProps and these functions
export class uPlotApplet {
    constructor (parentNode=document.getElementById("applets"),settings=[]) { // customize the render props in your constructor
        this.parentNode = parentNode;
        this.AppletHTML = null;

        this.renderProps = {  //Add properties to set and auto-update the HTML
            width: "100px",
            height: "100px",
            id: String(Math.floor(Math.random()*1000000))
        }

        this.settings = settings;
        if(settings.length > 0) { this.configure(settings);}

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
                <select id="`+props.id+`channel"></select>
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
          
          if(document.getElementById(this.renderProps.id+'mode').value === "CoherenceTimeSeries" || document.getElementById(this.renderProps.id+'mode').value === "Coherence"){
            addCoherenceOptions(this.renderProps.id+'channel',true,['All']);
          }
          else{
            addChannelOptions(this.renderProps.id+'channel',true,['All']);
          }
          if (document.getElementById(this.renderProps.id+'mode').value === "CoherenceTimeSeries") {
            document.getElementById(this.renderProps.id+"bandview").style.display="";
          }
          else {
            document.getElementById(this.renderProps.id+"bandview").style.display="none";
          }
          
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
            

        }
        document.getElementById(this.renderProps.id+'bandview').onchange = () => {
            if(document.getElementById(this.renderProps.id+'mode').value === "CoherenceTimeSeries"){
                this.setuPlot();
            }
        }
        document.getElementById(this.renderProps.id+'channel').onchange = () => {
          this.setuPlot();
        }

        addChannelOptions(this.renderProps.id+'channel',true,['All']);
        
    }   

    //Initialize the applet. Keep the first line.
    init() {
        this.AppletHTML = new DOMFragment(this.HTMLtemplate,this.parentNode,this.renderProps,()=>{this.setupHTML()},undefined,"NEVER"); //Changes to this.props will automatically update the html template
        
        this.setPlotDims();
        
        this.class = new uPlotMaker(this.renderProps.id+'canvas');
        //this.setuPlot();
        this.sub = State.subscribe('FFTResult',()=>{try{this.onUpdate();}catch(e){console.error(e);}});
    }

    
    configure(newsettings=this.settings) { //Expects an array []
      this.settings=newsettings;
      settings.forEach((cmd,i) => {
          //if(cmd === 'x'){//doSomething;}
      });
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
        this.loop = requestAnimationFrame(this.updateLoop);
    }

    stop = () => {
      cancelAnimationFrame(this.loop);
      this.loop = null;
    }

    onUpdate = () => {
      var graphmode = document.getElementById(this.renderProps.id+"mode").value;
      var view = document.getElementById(this.renderProps.id+"channel").value;
      let ch = null; 
        if (view !== "All") {
          ch = parseInt(view);
        }
      if(graphmode === "FFT"){
          //Animate plot(s)
          this.class.uPlotData = [
              ATLAS.fftMap.shared.bandPassWindow.slice(State.data.fftViewStart,State.data.fftViewEnd)
          ];
            ATLAS.channelTags.forEach((row,i) => {
              if(row.viewing === true && (State.data.fdBackMode !== "coherence" || (State.data.fdBackMode === "coherence" && (row.tag !== 'other' && row.tag !== null)))) {
                if(view === 'All' || row.ch === ch) {
                  this.class.uPlotData.push(State.data.FFTResult[i].slice(State.data.fftViewStart,State.data.fftViewEnd));
                }
              }
            });
          
      }
      else if (graphmode === "Coherence") {
        if(view === 'All') {
          this.class.uPlotData = [ATLAS.coherenceMap.shared.bandPassWindow.slice(State.data.fftViewStart,State.data.fftViewEnd)];
          console.log(State.data.coherenceResult)
          State.data.coherenceResult.forEach((result,i) => {
            this.class.uPlotData.push(result.slice(State.data.fftViewStart,State.data.fftViewEnd));
          })
        }
        else{
          ATLAS.coherenceMap.map.find((o,i) => {
            console.log(o)
            if(o.tag === view) {
              this.class.uPlotData = [ATLAS.fftMap.shared.bandPassWindow.slice(State.data.fftViewStart,State.data.fftViewEnd),o.data.amplitudes[o.data.count-1].slice(State.data.fftViewStart,State.data.fftViewEnd)];
              return true;
            }
          });
        }
        //console.log(this.class.uPlotData);
      }
      else if (graphmode === "CoherenceTimeSeries") {
        var band = document.getElementById(this.renderProps.id+"bandview").value
        
        var count = ATLAS.coherenceMap.map[0].data.count-1;
        //console.log(ATLAS.coherenceMap.map[0].data.times[count-1])
        //console.log(State.data.nSecAdcGraph)
        if(this.class.uPlotData[0].length > EEG.sps*State.data.nSecAdcGraph*.025) {
          this.class.uPlotData[0].shift();
        }
        console.log(EEG.sps*State.data.nSecAdcGraph)
        console.log(this.class.uPlotData[0].length)
        this.class.uPlotData[0].push(ATLAS.coherenceMap.map[0].data.times[count])// = [ATLAS.coherenceMap.map[0].data.times.slice(count, ATLAS.coherenceMap.map[0].data.count)];
        
          ATLAS.coherenceMap.map.forEach((row,i) => {
            if(this.class.uPlotData[i+1].length > EEG.sps*State.data.nSecAdcGraph*.025) {
              this.class.uPlotData[i+1].shift();
            }
            if(view === 'All') {
              this.class.uPlotData[i+1].push(eegmath.sma(row.data.means[band].slice(count-10, ATLAS.coherenceMap.map[0].data.count),10)[9]);
            } else if (row.tag === view) {
              this.class.uPlotData[i+1].push(eegmath.sma(row.data.means[band].slice(count-10, ATLAS.coherenceMap.map[0].data.count),10)[9]);
            }
          });
        
        
        //Do a push and pop and get the moving average instead
      }
      else {
        var nsamples = Math.floor(EEG.sps*State.data.nSecAdcGraph);
        if(nsamples > EEG.data.counter) {nsamples = EEG.data.counter-1}

        if ((graphmode === "TimeSeries") || (graphmode === "Stacked")) {
            var nsamples = Math.floor(EEG.sps*State.data.nSecAdcGraph);
            if(nsamples > EEG.data.counter) { nsamples = EEG.data.counter-1;}
            this.class.uPlotData = [
                EEG.data.ms.slice(EEG.data.counter - nsamples, EEG.data.counter)
            ];
              ATLAS.channelTags.forEach((row,i) => {
                if(row.viewing === true) {
                  if(view === 'All' || row.ch === ch) {  
                    if(State.data.useFilters === true) {
                      this.class.uPlotData.push(State.data.filtered["A"+row.ch].slice(State.data.counter - nsamples, State.data.counter));
                    } else {
                      this.class.uPlotData.push(EEG.data["A"+row.ch].slice(EEG.data.counter - nsamples, EEG.data.counter));
                    }
                  } 
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
        var view = document.getElementById(this.renderProps.id+"channel").value;
        let newSeries = [{}];
        let ch = null; 
        if (view !== "All") {
          ch = parseInt(view);
        }
        if(gmode === "TimeSeries"){
          document.getElementById(this.renderProps.id+"title").innerHTML = "ADC signals";
      
          if(EEG.data["A0"].length > 1) {
            var nsamples = Math.floor(EEG.sps*State.data.nSecAdcGraph);
            if(nsamples > EEG.data.counter) {nsamples = EEG.data.counter-1;}
      
            this.class.uPlotData = [
                EEG.data.ms.slice(EEG.data.counter - nsamples, EEG.data.counter)
            ];
              ATLAS.channelTags.forEach((row,i) => {
                  if(row.viewing === true) {
                    if(view === 'All' || row.ch === ch) {
                      if(State.data.useFilters === true) {
                        this.class.uPlotData.push(State.data.filtered["A"+row.ch].slice(State.data.counter - nsamples, State.data.counter));
                      } else {
                        this.class.uPlotData.push(EEG.data["A"+row.ch].slice(EEG.data.counter - nsamples, EEG.data.counter));
                      }
                    }
                  }
              });
            
            }
          else {
            this.class.uPlotData = [[...ATLAS.fftMap.shared.bandPassWindow]];
              ATLAS.channelTags.forEach((row,i) => {  
                if(view === 'All' || row.ch === ch) {
                  this.class.uPlotData.push([...ATLAS.fftMap.shared.bandPassWindow]);
                }
              });
            
          }

          if(view !== "All") {newSeries = this.class.makeSeriesFromChannelTags(ATLAS.channelTags,true,ch);}
          else {newSeries = this.class.makeSeriesFromChannelTags(ATLAS.channelTags,true);}
          this.class.makeuPlot(
              newSeries, 
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
                ATLAS.fftMap.shared.bandPassWindow.slice(State.data.fftViewStart,State.data.fftViewEnd)
              ];
              if((State.data.FFTResult.length > 0) && (State.data.FFTResult.length <= ATLAS.channelTags.length)) {
                //console.log(posFFTList);
                  ATLAS.channelTags.forEach((row,i) => {
                    if(i < State.data.FFTResult.length){
                      if(row.viewing === true && (State.data.fdBackMode !== "coherence" || (State.data.fdBackMode === "coherence" && (row.tag !== 'other' && row.tag !== null)))) {
                        if(view === 'All' || row.ch === ch) {
                          this.class.uPlotData.push(State.data.FFTResult[i].slice(State.data.fftViewStart,State.data.fftViewEnd));
                        }
                      }
                    }
                    else {
                      if(view === 'All' || row.ch === ch) {
                        this.class.uPlotData.push(ATLAS.fftMap.shared.bandPassWindow.slice(State.data.fftViewStart,State.data.fftViewEnd)); // Placeholder for unprocessed channel data.
                      }
                    }
                  });
                
              }
              else {
                ATLAS.channelTags.forEach((row,i) => {   
                  if(view === 'All' || row.ch === ch) {
                    this.class.uPlotData.push(ATLAS.fftMap.shared.bandPassWindow.slice(State.data.fftViewStart,State.data.fftViewEnd));
                  }
                });
              }

              if(view !== "All") {newSeries = this.class.makeSeriesFromChannelTags(ATLAS.channelTags,true,ch);}
              else {newSeries = this.class.makeSeriesFromChannelTags(ATLAS.channelTags,true);}

              //console.log(newSeries);
              //console.log(this.class.uPlotData);
              //console.log(newSeries)
              this.class.makeuPlot(
                  newSeries, 
                  this.class.uPlotData, 
                  this.plotWidth, 
                  this.plotHeight
                );
        }
        else if (gmode === "Stacked") {
      
          if(EEG.data["A0"].length > 1){
          var nsamples = Math.floor(EEG.sps*State.data.nSecAdcGraph);
          if(nsamples > EEG.data.counter) {nsamples = EEG.data.counter-1}
      
            this.class.uPlotData = [
                EEG.data.ms.slice(EEG.data.counter - nsamples, EEG.data.counter)
            ];
              ATLAS.channelTags.forEach((row,i) => {
                if(row.viewing === true) { 
                  if(view === 'All' || row.ch === ch) {
                    if(State.data.useFilters === true) {
                      this.class.uPlotData.push(State.data.filtered["A"+row.ch].slice(State.data.counter - nsamples, State.data.counter));
                    } else {
                      this.class.uPlotData.push(EEG.data["A"+row.ch].slice(EEG.data.counter - nsamples, EEG.data.counter));
                    }
                  }
                }
              });
          }
          else {
            this.class.uPlotData = [[...ATLAS.fftMap.shared.bandPassWindow]];
            ATLAS.channelTags.forEach((row,i) => {
              if(view === 'All' || row.ch === ch) {
                this.class.uPlotData.push([...ATLAS.fftMap.shared.bandPassWindow]);
              }
            });
          }
      
          document.getElementById(this.renderProps.id+"title").innerHTML = "ADC signals Stacked";
      
          //console.log(uPlotData)
          this.class.makeStackeduPlot(
              undefined, 
              this.class.uPlotData,
              undefined, 
              ATLAS.channelTags,
              this.plotWidth, 
              this.plotHeight
            );
          this.class.plot.axes[0].values = (u, vals, space) => vals.map(v => +(v*0.001).toFixed(2) + "s");
      
        }
        else if (gmode === "Coherence") {
          ATLAS.coherenceMap.map.forEach((row,i) => {
            if(view === 'All' || row.tag === view) {
              newSeries.push({
                label:row.tag,
                value: (u, v) => v == null ? "-" : v.toFixed(1),
                stroke: "rgb("+Math.random()*255+","+Math.random()*255+","+Math.random()*255+")"
              });
            }
          });

          if((State.data.coherenceResult.length > 0) && (State.data.coherenceResult.length <= ATLAS.coherenceMap.map.length)){
            if(view === 'All') {
              this.class.uPlotData = [ATLAS.coherenceMap.shared.bandPassWindow.slice(State.data.fftViewStart,State.data.fftViewEnd)];
              State.data.coherenceResult.forEach((result,i) => {
                this.class.uPlotData.push(result.slice(State.data.fftViewStart,State.data.fftViewEnd));
              });
              if(this.class.uPlotData.length < ATLAS.coherenceMap.map.length+1) {
                for(var i = this.class.uPlotData.length; i < ATLAS.coherenceMap.map.length+1; i++){
                  this.class.uPlotData.push(ATLAS.coherenceMap.shared.bandPassWindow.slice(State.data.fftViewStart,State.data.fftViewEnd));
                }
              }
            }
            else{
              ATLAS.coherenceMap.map.find((o,i) => {
                if(o.tag === view) {
                  this.class.uPlotData = [ATLAS.coherenceMap.shared.bandPassWindow.slice(State.data.fftViewStart,State.data.fftViewEnd),o.data.amplitudes[o.data.count-1].slice(State.data.fftViewStart,State.data.fftViewEnd)];
                  return true;
                }
              });
            }
          }
          else {
            this.class.uPlotData = [ATLAS.coherenceMap.shared.bandPassWindow.slice(State.data.fftViewStart,State.data.fftViewEnd)];
            ATLAS.coherenceMap.map.forEach((row,i) => {
              if(view === 'All' || row.tag === view) {
                this.class.uPlotData.push(ATLAS.coherenceMap.shared.bandPassWindow.slice(State.data.fftViewStart,State.data.fftViewEnd));
              }
            });
          }
          //console.log(newSeries);
          console.log(this.class.uPlotData);
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
          
          var count = ATLAS.coherenceMap.map[0].data.count-1;
          //console.log(ATLAS.coherenceMap.map[0].data.times[count-1])
          while(ATLAS.coherenceMap.map[0].data.times[ATLAS.coherenceMap.map[0].data.count-1]-ATLAS.coherenceMap.map[0].data.times[count-1] < State.data.nSecAdcGraph*1000 && count > 0) {
            count-=1;
          }

          this.class.uPlotData = [ATLAS.coherenceMap.map[0].data.times.slice(count, ATLAS.coherenceMap.map[0].data.count)];

          ATLAS.coherenceMap.map.forEach((row,i) => {
            if(view === 'All' || row.tag === view) {
              newSeries.push({
                label:row.tag,
                value: (u, v) => v == null ? "-" : v.toFixed(1),
                stroke: "rgb("+Math.random()*255+","+Math.random()*255+","+Math.random()*255+")"
              });
              this.class.uPlotData.push(eegmath.sma(row.data.means[band].slice(count, ATLAS.coherenceMap.map[0].data.count),5));
            }
          });
          //console.log(this.class.uPlotData)
          this.class.makeuPlot(
              newSeries, 
              this.class.uPlotData, 
              this.plotWidth, 
              this.plotHeight
            );
          document.getElementById(this.renderProps.id+"title").innerHTML = "Mean Coherence over time";
          this.class.plot.axes[0].values = (u, vals, space) => vals.map(v => +(v*0.001-ATLAS.coherenceMap.map[0].data.times[0]).toFixed(2) + "s");
        }
        //else if(graphmode === "StackedRaw") { graphmode = "StackedFFT" }//Stacked Coherence
      }

}