## Applets
The applet system here is just a simple way to make sure that modular content gets nested correctly in the app with everything else. As long as you maintain the basic format in the template, you can write any kind of javascript you want otherwise and involve any packages you want.

Check out AppletTemplate.js in the applets folder. You'll see a bunch of mostly empty functions and a constructor. In order to create applets, you need to copy and paste this template to a new file and then fill out all of the functions. You can try to extend the class too but I find that to be more mental work than it should be. 

The most important function to make something happen on screen is the HTMLtemplate, then use the setupHTML function to attach functions to buttons etc. Leave the random id generator alone, also, or make sure you use something just as random, as that lets you add a randomized id to all of your named html elements so they don't accidentally overlap with others. 

See how this all works in the other examples, the simplest being AppletExample.js. You can use State.subscribe('propname',onchange) to get updates from the app, then pull data from the EEG or ATLAS objects accordingly. Feel free to add any state variables you want. 

The configure() function is used if you instantiate the applet from a hashtag on the address bar (or if you want to customize a link/shortcut). If your applet has multiple view options etc you can have it be configurable. This will work with a config autosave system being implemented here (probably already done before anyone reads this file) so that when you restart the app, the applets can be reconfigured from file exactly how you want them.

When you want to test your applet, right now you add it to app.js by including it from the file then adding an object to 
State.data.appletClasses.push( just under all of the includes. Format the object just like the other ones there with a name for the applet and the class reference then it should appear and get run through the UI manager.

--

Let me know if that's too confusing, there are a ton of examples. I tried to boil React and other systems down to nothing and get rid of any fluff regarding the state systems and the special syntax you have to apply to everything. Even lit html irritated me because there were a couple things that for some reason were made more difficult than vanillaJS, which in my mind totally kills the purpose, but I am not an erudite coder and just want to get straight to the point with snappy html for visualizing my scripts. You'll notice that literally everything is rendered from javascript in this app so it's all done with the fragment system.