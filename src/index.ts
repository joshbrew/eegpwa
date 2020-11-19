import './initializer';

import { main } from './main'
import { viewSize } from '@giveback007/util-lib/dist/browser'

import 'regenerator-runtime/runtime'
import "./js/utils/uPlot.iife.min.js"
import "./js/utils/smoothie.min.js"
import "./js/utils/webgl-heatmap.js"
import "./js/eeg32.js"
import "./js/utils/gpu-browser.min.js"
import "./js/utils/gpuUtils.js"
import './js/utils/eegworker.js'
import './js/app.js'
//import { elm } from './util/util';


main(); // import test

//setTimeout(() => elm('title').style = 'opacity: 0;', 2500);

if (process.env.NODE_ENV === 'development') {
    console.log('DEV MODE');

    window.onresize = () => {
        console.clear();
        console.log(viewSize())
    };
}

if (process.env.NODE_ENV === 'production') {
    console.log('Production');
    
    // import * as serviceWorker from './service-worker';
    const serviceWorker = require('./service-worker');
    // If you want your app to work offline and load faster, you can change
    // unregister() to register() below. Note this comes with some pitfalls.
    serviceWorker.register();
}
