Assistant Performer
------------

This application is an experimental music score player with conducting options.<br>Its purpose is to test and develop  
&nbsp;&nbsp;&nbsp;&nbsp;1.&nbsp;&nbsp;the **_SVG-MIDI_** format in which the scores are stored  
&nbsp;&nbsp;&nbsp;&nbsp;2.&nbsp;&nbsp;the ways in which users can interact with playback.

This repository has two major branches:  
&nbsp;&nbsp;&nbsp;&nbsp;**stable**: the current [stable application](https://james-ingram-act-two.de/open-source/assistantPerformer/assistantPerformer.html).  
&nbsp;&nbsp;&nbsp;&nbsp;**dev**: the [unstable development application](https://james-ingram-act-two.de/open-source/assistantPerformerTestSite/assistantPerformer.html).

The **dev** branch has been fully merged into the **stable** branch in May 2024, and the two online web applications are now identical. There is, however, no guarantee that this will always be the case.

The _Assistant Performer_ allows the user to select an output device from any of the available virtual or hardware MIDI synthesizers it can currently find in the system.<br>These now always include the permanently installed **_ResidentSynth_** (**[GitHub](https://github.com/notator/ResidentSynthHostTestSite), [Documentation](https://james-ingram-act-two.de/open-source/aboutResidentSynthHost.html)**). 

---

This project is designed to be an investigation of the concepts involved. It is not intended to be a finished product. Its top-level architecture and _what it does_ is much more important than the actual code. Both the _Assistant Performer_ and the _ResidentSynth_ are working _prototypes_ whose actual code might well be improved.

Neither the _Assistant Performer_ nor the _ResidentSynth_ require use of the Web _MIDI_ API. The synthesizer _implements_ the Web MIDI MIDIOutput interface using the Web _Audio_ API.

The **_SVG-MIDI_** format is SVG containing embedded MIDI information.  
Code for _event symbols_ in the scores contain both spatial (SVG) and temporal (MIDI) information. This allows the _Assistant Performer_ to  
&nbsp;&nbsp;&nbsp;&nbsp;1.&nbsp;&nbsp;synchronize the position of running cursors with live audio output  
&nbsp;&nbsp;&nbsp;&nbsp;2.&nbsp;&nbsp;give the user control over the start- and end-points of playback.

Currently, the scores are all written using a simplified version of standard Western music notation. This could, in principle, change in future: _All_ music notations contain _event symbols_ whose appearance (in space) is independent of their meaning (in time), so any music notation (designed for writing on paper) could be extended (when stored in a computer file) to contain temporal information.

James Ingram  
May 2024
