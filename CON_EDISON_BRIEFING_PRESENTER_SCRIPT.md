# MusterCommand · Con Edison Floor 07 Briefing: Presenter Script

**Presenters:** Robert Petillo and Samuel McFarlane  
**Running time:** About 7 minutes plus phone demo and questions  

---

## Purpose of the Meeting
Show the stakeholders that we understand the problem they experience during drills and real evacuations. Show a working prototype they can touch. Leave with two things: **a named contact for the floor data** and **a date for the first drill**.

---

## Roles

| Presenter | Owns |
| :--- | :--- |
| **Robert Petillo** | The floor and the people: opens, owns the timeline, runs the phone demo, makes the asks, closes. |
| **Samuel McFarlane** | The system: explains how it works, runs the commander side of the demo, answers technical questions. |

---

## Before the Meeting
* Run the prototype on the laptop that will connect to the room display (see Appendix A). Confirm the phone can open the sign-in page.
* Use the presenter display for slides. Robert holds the clicker. Sam says "next" to request a slide.
* Know the three numbers: **195 people on the floor**; the timeline **9:42, 9:46, 10:06**; the **three asks**.
* Do not open the Clean Data button during the demo. It resets the roster.
* Keep the backup slides hidden until asked.

---

## Language Guide

| Say | Do Not Say | Reason |
| :--- | :--- | :--- |
| **working prototype** | *finished product* | It is not finished, and the room will find out. |
| **made-up data, synthetic floor** | *real floor* | The data is made up. Say so before anyone asks. |
| **the accounting takes twenty minutes** | *we cut evacuation time* | People still walk at the same speed. The accounting is what changes. |
| **a target we would hold ourselves to** | *guaranteed under five minutes* | It is a target, not a measured result. |
| **tamper-evident log** | *tamper-proof, blockchain* | The log detects edits. It is not blockchain. |
| **not yet connected to the alarm panel** | *sends SMS alerts* | Alerts are logged in the prototype; no SMS provider is connected. |

---

## 1. Opening
**0:00 to 0:20 · Slide 1: Title**

* **ROBERT:** Thank you for making the time. I am Robert Petillo. This is Samuel McFarlane. We built MusterCommand, and today we want to walk you through one morning on a single floor.
* **ROBERT:** Before we start, one thing to be clear about. Everything you will see runs on made-up data: made-up names, made-up counts, a made-up floor. We will point out the limits as we go.

> **Cue:** Pause after "made-up." Do not rush the disclosure.

---

## 2. Two Imperatives, One Customer
**0:20 to 0:40 · Slide 2**

* **SAM:** We started with two things that have to be true at the same time. Safety means every person accounted for, in seconds, with a location, not an estimate. Operational excellence means the drill produces its own evidence as it happens, instead of someone spending half a day rebuilding what people remember.
* **ROBERT:** The third one changed the design. On a floor, the customer is the person in the stairwell: employee, contractor, or visitor. They do not have time to learn a new tool. So the rule is one screen, two buttons, and no training.

> **Cue:** Sam finishes on "no training." Robert picks up with "that is why the phone is the whole interface."

---

## 3. Today
**0:40 to 1:40 · Slide 3: Today, the evacuation takes four minutes; the accounting takes twenty**

* **ROBERT:** It is 9:42 on Floor 07. The alarm sounds. One hundred ninety-five people start moving toward the stairwells.
* **ROBERT:** At 9:46 the floor is clear. Four minutes. That part works.
* **ROBERT:** Then the part that does not work. Staff leads reach the street with a roster printed at eight o'clock. Headcounts go over one radio channel, one quadrant at a time. Two names are unaccounted for, and nobody knows whether those two people are still inside. A staff lead goes back up to check.
* **ROBERT:** At 10:06, all clear. Twenty-four minutes after the alarm.
* **SAM:** And the only record is a handwritten sheet and what people remember.
* **ROBERT:** For those twenty minutes, no one could say who was safe, who was missing, and who needed help. Not because anyone did anything wrong. Because there is no system that answers that question.

> **Cue:** Stop and count three seconds after the last line. Then advance.  
> *If asked about the timings:* "They are illustrative on a synthetic floor. The shape is what matters. The pilot gives us your real numbers."

---

## 4. With MusterCommand
**1:40 to 2:20 · Slide 4: Same floor, same alarm, everyone signed in that morning**

* **SAM:** Same floor, same alarm, one difference. At eight in the morning, everyone scans a QR code at the entrance. Badge or visitor pass, about two seconds. They are on the live roster before the alarm sounds.
* **ROBERT:** At 9:42 the staff lead declares. Every signed-in phone switches to evacuation, with the stairwell and the meeting point on screen.
* **SAM:** The floor is still clear at 9:46, in the same four minutes. We did not make people walk faster.
* **ROBERT:** At 9:50, 191 of 195 have tapped "I am safe." One person tapped "I need help," and a responder is routed to them by name, not by radio.
* **SAM:** Two of the remaining three resolve. The last one never badged in, and the system already knew that. It shows as not in the building, not as missing.
* **ROBERT:** Everyone accounted for eight minutes after the alarm. Sixteen minutes back. The emergency works because the morning already happened.

> **Cue:** Robert ends on "the morning already happened." Sam picks up with "that is why the sign-in every day matters."  
> *The 191 / 2 / 1 / 1 breakdown is illustrative. If asked for real figures:* "We need your floor data to produce real ones. That is the pilot."

---

## 5. What That Morning Changes
**2:20 to 3:00 · Slide 5: What that morning changes**

* **ROBERT:** On the safety side: time to all safe is measured, not estimated. Unaccounted people surface with a last known quadrant. Assistance requests reach a responder by name. Silence is never read as safety.
* **SAM:** On the operations side: the drill record writes itself as it happens. Compliance evidence is generated, not reconstructed. One sign-in serves attendance, visitors, and drills, so the data stays current between drills.
* **ROBERT:** Safety gets us in the door. Operational excellence is why it still gets used on a Tuesday with no drill scheduled.

---

## 6. How It Is Built, and the Limits
**3:00 to 3:45 · Slide 6: How it is built**

* **SAM:** It runs in any phone browser. No app, no account. The front end is React and TypeScript. The server is Node and Express, with live updates to every screen, so nobody reads a stale count. Each role sees its own view of the same system.
* **ROBERT:** Now the limits. The state is held in memory right now. The roster is synthetic. The system does not yet connect to the fire alarm panel.

> **Cue:** Let the limits sit. Do not add a qualifier. This is the trust moment.

---

## 7. Phone Demo
**3:45 to 5:15 · Phone and commander laptop. Slide 7 stays up as the fallback.**

**Setup:** The phone and the laptop on the same Wi-Fi. The phone is mirrored to the room display, or passed around the table. The commander console is open on the laptop. Practice this section once before the meeting.

| Step | Who | What happens | What to say |
| :---: | :---: | :--- | :--- |
| **1** | **Robert** | Opens the sign-in page on the phone and taps Worker. | *"This is what every person does on the way in. Two seconds."* |
| **2** | **Robert** | Signs in as Robert Petillo. | *"Now I am on the roster."* |
| **3** | **Sam** | Commander console: the new check-in appears live. | *"That update just reached the commander without a radio call."* |
| **4** | **Sam** | Declares a drill from the commander console. | *"Same as the alarm. The staff lead declares."* |
| **5** | **Robert** | Phone switches to evacuation. Robert taps "I am safe." | *"That is one of the 191. It counts immediately."* |
| **6** | **Sam** | Commander count updates. | *"Now we know exactly who is still outstanding."* |

> **Fallback Rule:** If the phone or Wi-Fi fails: say *"We will use the screenshots,"* go to slide 7, and continue. Do not troubleshoot in front of the room.

---

## 8. The Three Asks
**5:15 to 5:45 · Slide 8: What we need from Con Edison**

* **ROBERT:** One: real floor data. The quadrants, the stairwells, the assembly points, and how your roster represents contractors and visitors.
* **ROBERT:** Two: drill records. Timings from recent drills, so the baseline is your number, not our guess.
* **ROBERT:** Three: one floor to pilot. A single scheduled drill, observed beside the current paper process.
* **SAM:** We are not asking for a decision today. We would rather be corrected now than build six more weeks on assumptions we invented.
* **ROBERT:** What we would like to leave with today is a name for the floor data and a date for the first drill. Who is the right person for that?

> **Cue:** Do not end the meeting without a name or a date. If neither is offered: *"Who should we follow up with, and by when?"*

---

## 9. Close
**5:45 to 6:00 · Slide 9: Next steps are a conversation**

* **SAM:** Here is what happens next. We finish this phase. You give us the real floor and drill data. Then we sit down and define what comes after. We will not propose a build plan before we have seen your numbers.
* **ROBERT:** What we want to be true when we leave is that we all agree on what "done" looks like on your floor.

> **Cue:** Stop talking. Let them ask. Then open Q&A: Sam takes the first technical question; Robert takes the first floor question.

---

## Questions & Answers

* **Is this live?**  
  **ROBERT:** It is a working prototype. You have seen it running. The data is made up, and it is not connected to the fire alarm panel yet. That is what the pilot is for.

* **Does it work without internet?**  
  **SAM:** The check-in path is designed to queue taps when the connection drops. We have not proven that on a real floor in a drill. We would test it in the pilot before anyone relies on it.

* **What if the server goes down?**  
  **SAM:** Right now the state is held in memory, so a restart clears it. That is one of the limits we named. Persistent storage is the first thing we would fix before a pilot.

* **Who can see where people are?**  
  **ROBERT:** The commander and the auditor see the full floor. Staff leads see their quadrant. Privacy rules for visitors and contractors are not finished, and we would want your HR and security teams in that conversation before a pilot.

* **Does this replace the fire alarm?**  
  **SAM:** No. It sits on top of the alarm. The alarm works. The gap is the accounting after it goes off, and we do not touch the alarm panel.

* **How accurate is the AI?**  
  **SAM:** The AI drafts summaries and answers questions from the live floor data. A person reviews it before it is official.

* **Is it FDNY compliant?**  
  **ROBERT:** We are not claiming that yet. The drill records are designed to be the kind of evidence an auditor would want. We need your compliance team to tell us the exact requirement. That is on the list of asks.

* **What does a pilot cost?**  
  **ROBERT:** Not on the table today. We are asking for data and one floor. Cost comes after we have seen your numbers.

* **Why trust a new team?**  
  **ROBERT:** Fair question. We built a working prototype in a few weeks through the Pursuit AI Native Builder Fellowship. We are not asking you to trust us with a building. We are asking for one floor and one drill, so you can judge the result yourself.

* **Where do the four and twenty minutes come from?**  
  **ROBERT:** They are illustrative, built on a synthetic floor to show the shape of the problem. Your drill records give you the real numbers. That is why we are asking for them.

> *Any question not on this list:* "That is a good one. We will write it down and send you the answer within a day." Log it for follow-up.

---

## Backup Slides (Only if Asked)
* **Five steps behind the timeline:** Sam.
* **Who sees what, with the sign-in screen:** Robert.
* **The four design rules:** Sam. If challenged on a design decision, ask: *"Which one would you change?"*

---

## Appendix A: Running the Prototype for the Phone Demo
Run these on the presenting laptop. Each line is a single command. **Do not run the Clean Data button during the demo.**

1. Download the prototype (once):
```bash
git clone https://github.com/SamMcfarlane-pursuit/fsd-remix-console ~/MusterCommand-demo
```
2. Install and start it (once, then each time you present):
```bash
cd ~/MusterCommand-demo && npm ci && npm run dev
```
3. Print the address to type into the phone (same Wi-Fi as the laptop):
```bash
echo "http://$(ipconfig getifaddr en0):3000/?mode=signin&scan=1"
```

Open the printed address on the phone. Test the full phone sequence on the laptop at least once before the meeting.
