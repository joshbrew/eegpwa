# Test for EEG browser PWA

Not working yet but you can test the EEG worker

with node
`npm install`

then

`npm start`

## Cool features

* GPU js FFTs with web workers enabling real time DSP for as many channel inputs as you want. Benchmarked 128 channels * 512 samples in 8.3ms, about 15ms-20ms average on an RTX 2060.
* Live charting, coherence, more to come - the UI is not done
* Modular data and visual tools with class based modules, and a modifiable decoder for enabling any hardware.
* Configured for the [FreeEEG32](https://github.com/neuroidss/freeeeg32_beta)
