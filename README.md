# Wiki Graph Explorer (WGE)

In the previous iteration, WGE was implemented as an extension for the Chrome browser, which prevented free distribution. Now this project has been rewritten for webview and is cross-platform.
  
![WGE](https://github.com/Apanazar/stuprum/blob/master/wge2.png)
![WGE](https://github.com/Apanazar/stuprum/blob/master/wge1.png)
---

## 🎯 Who It’s For & Why You’ll Love It

Whether you’re a curious student, a researcher tracing citation paths, or just someone who loves diving deep into Wikipedia’s rabbit holes, Wiki Graph Explorer was made for you. Here’s how it helps:

### ✅ Effortless Exploration  
- **Instant overview** of an article’s link neighborhood—no more endless scrolling.  
- **Drag-and-drop links** onto the canvas to bookmark and compare topics visually.

### 👩‍🎓 Ideal for Learners & Educators  
- **Visualize citation chains** in historical, scientific, or literary topics.  
- **Spot connection gaps**—see related articles you might otherwise miss.  
- **Build custom mind-maps** on the fly for lesson plans or presentations.

### 🔍 Perfect for Researchers & Analysts  
- **Quickly map key concepts** and their interdependencies.  
- **Save & share** your graph JSON to collaborate or revisit later.  
- **Detect isolated clusters** and discover under-linked pages.

### 🛠 Solves Common Frustrations  
- No more copy/paste URL juggling—just click or drag to expand.  
- Banish endless “find in page” hunts; the graph shows links at a glance.  
- Avoid losing context: the side panel keeps article text alongside your map.  

In short, Wiki Graph Explorer turns linear Wikipedia browsing into an immersive, visual journey—making research, teaching, and curiosity-driven exploration faster, clearer, and more fun.  


## 🔹 Universal Wikipedia Support  
- Paste **any** `https://wikipedia.org/wiki/...` URL (you can insert a link to any website).
- One-click **Random** fetches a surprise article.
- You can create and keep **notes** directly on the graph canvas.
- If your system browser engine supports this, then you can insert even **files** into the graph canvas.


## 🔹 Interactive Vis-Network Graph  
- **Nodes** = articles; **edges** = Wikipedia links.  
- **Click** a node to fetch & display.  
- **Shift+Click** two nodes to draw a custom connection.  
- **Right-click** node menu:  
  - **Open** (re-parse & refresh)  
  - **Delete**  
  - **Detach** (temporarily hide edges)  
- **Drag & Drop** any link from the article panel onto the canvas to spawn a standalone node.

## 🔹 Save & Load Graphs  
- **Save** your current node+edge graph as a JSON file.  
- **Load** a saved JSON to restore sessions instantly.

## 🔹How to build?
- To build a project **cross-platform**, you do not need any actions other than the standard `go build`.


---