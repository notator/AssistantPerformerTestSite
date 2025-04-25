## Assistant Performer (2025)

The **Assistant Performer (2025)** is a development of the original [**Assistant Performer**](https://james-ingram-act-two.de/open-source/assistantPerformer/assistantPerformer.html). It implements new functionality made possible by the use of a new score format.<br>
The new format, written by [**Moritz (2025)**](https://github.com/notator/Moritz), changes the way chord and rest symbols store MIDI information.<br>
These are breaking changes, so not all the original scores are supported.<br>
For this reason, the original **Assistant Performer** is going to remain online, with all its scores.<br>
When ready, the **Assistant Performer (2025)** will be uploaded at a different, parallel address.

The chord format has changed as follows:
1. Multiple _interpretations_ of a particular score are now supported.
    The _Study 1 (2025)_ and _Pianola Music (2025)_ scores include such alternative, predefined interpretations.
    Such interpretations will be selectable from the **Assistant Performer (2025)** user interface.<br>
    The _Pianola Music (2025)_ score now repeats automatically, relating each repeat to a particular interpretation.

2. There is now a one to one correspondence between chord symbols and performed events (key presses).<br>
    This is important when the score is being played or recorded _live_ by a human performer using the ResidentSynthHost.<br>
    In future, it should be possible to copy such live MIDI recordings into the score, in order to develop performance practice.<br>
    So **Moritz 2025** no longer uses palettes as a way to define ornaments. (They are now implemented internally by the ResidentSynth.)<br>
    Scores containing embedded ornaments, such as _Study 2_, are therefore not supported by the **Assistant Performer (2025)**. 

---

This application is an experimental music score player with conducting options.<br>Its purpose is to test and develop  
&nbsp;&nbsp;&nbsp;&nbsp;1.&nbsp;&nbsp;the **_SVG-MIDI_** format in which the scores are stored  
&nbsp;&nbsp;&nbsp;&nbsp;2.&nbsp;&nbsp;the ways in which users can interact with playback.

This repository has two major branches:   
&nbsp;&nbsp;&nbsp;&nbsp;**dev**: the [unstable development application](https://james-ingram-act-two.de/open-source/assistantPerformerTestSite/assistantPerformer.html).  
&nbsp;&nbsp;&nbsp;&nbsp;**stable**: the current [stable application](https://james-ingram-act-two.de/open-source/assistantPerformer/assistantPerformer.html).  

The **dev** branch has been fully merged into the **stable** branch in May 2024, and the two online web applications are now identical. There is, however, no guarantee that this will always be the case.

The _Assistant Performer_ now uses the **_ResidentSynth_** (**[GitHub](https://github.com/notator/ResidentSynthHostTestSite), [Documentation](https://james-ingram-act-two.de/open-source/aboutResidentSynthHost.html)**) as its only MIDI output device. This means that it no longer requires use of the **Web MIDI API**. The _ResidentSynth_ is  a MIDI output device that is implemented using the **Web Audio API** .

---

This project is designed to be an investigation of the concepts involved. It is not intended to be a finished product. Its top-level architecture and _what it does_ is much more important than the actual code. Both the _Assistant Performer_ and the _ResidentSynth_ are working _prototypes_ whose actual code might well be improved.

Neither the _Assistant Performer_ nor the _ResidentSynth_ require use of the Web _MIDI_ API. The synthesizer _implements_ the Web MIDI MIDIOutput interface using the Web _Audio_ API.

The **_SVG-MIDI_** format is SVG containing embedded MIDI information.  
Code for _event symbols_ in the scores contain both spatial (SVG) and temporal (MIDI) information. This allows the _Assistant Performer_ to  
&nbsp;&nbsp;&nbsp;&nbsp;1.&nbsp;&nbsp;synchronize the position of running cursors with live audio output  
&nbsp;&nbsp;&nbsp;&nbsp;2.&nbsp;&nbsp;give the user control over the start- and end-points of playback.

Currently, the scores are all written using a simplified version of standard Western music notation. This could, in principle, change in future: _All_ music notations contain _event symbols_ whose appearance (in space) is independent of their meaning (in time), so any music notation (designed for writing on paper) could be extended (when stored in a computer file) to contain temporal information.

**[The _Assistant Performer_ ´s main documentation can be found here](https://james-ingram-act-two.de/open-source/aboutAssistantPerformer.html)**.

James Ingram  
April 2025
