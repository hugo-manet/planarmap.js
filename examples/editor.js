var svg = d3.select("#pmap").append("svg")
	.attr("id","pmapsvg")
	.attr("width","100%")
	.attr("height","100%")
	.attr("viewBox","-160 -100 320 200")
	.attr("preserveAspectRatio", "xMidYMid meet")	
	
var planarmap = CMap.PlanarMap();
var layoutupdater = CMap.LayoutUpdater()
	.registerAll(planarmap);

planarmap.singleEdgeMap();	
	
var view = CMap.View(planarmap,svg).zoom().nodeLabelOffset([0,1.1]);
view.nodeText(function(node){
	return node.attr.id ;
}).updateLayers();

var force = CMap.force(planarmap)
	.centerPull({pull: true, center: new Vec2(0,0), coupling: 0.1})
	.stretchForce(true)
	.on("tick",function(){ 
		layoutupdater.attemptStretch(planarmap);
		view.updatePositions();
	})
	.resume();
layoutupdater.onChange(function(){ force.resume() });

var control = CMap.ControlPanel(".panelcontainer");

var filepanel = control.addPanel("file","File",false,function(){});
var fileload = filepanel.addEmpty();
fileload.append("input").attr("type","file")
	.attr("id","fileinput")
	.attr("accept",".json,.svg")
	.style("display","none")
	.on("change",function(){
		var file = this.files[0];
		var reader = new FileReader();
		reader.onload = function(e) {
			var json;
			try{
				// first try parsing as pure JSON
				json = JSON.parse(reader.result);
			}catch(e){
				// otherwise try to find CDATA-field in file and parse that
				var cdata = reader.result.split('<jsondata><'+'![CDATA[');
				if( cdata.length < 2 )
					return;
				cdata = cdata[1].split(']]>')[0];
				try{
					json = JSON.parse(cdata);
				}catch(e2){
					return;	
				}
			}
			planarmap.fromJSON(json);
			view.updateLayers(true);
			view.updatePositions();
			force.resume();
		}
		reader.readAsText(file);

		this.value = "";
	});

	
fileload.append("input").attr("type","button")
	.attr("value","Load JSON or SVG...")
	.on("click",function(){
		document.getElementById("fileinput").click();
	});
	
	
(function(){
	var exampleselect = filepanel.addEmpty().append("select")
		.on("change",function(){
			if( this.value != "" )
			{
				// make copy of example data
				addStateToUndoHistory();
				view.clearSelection();
				var json = JSON.parse(JSON.stringify(exampledata[this.value]));
				planarmap.fromJSON(json);
				view.updateLayers(true);
				view.updatePositions();
			}
			this.value="";
			this.blur();
		});
	exampleselect
		.append("option")
		.attr("class","selectheader")
		.text("---- Load example ----")
		.attr("value","");
		
	var examples = [
		["Triangulation","triangulation"],
		["Quadrangulation","quadrangulation"],
		["Plane tree","tree"],
		["Square grid","squaregrid"],
		["Goldner-Harary","goldner-harary"],
		["Dodecahedron","dodecahedron"]
	];
	
	exampleselect.selectAll("option.selectoption")
			.data(examples)
			.enter().append("option")
			.attr("class","selectoption")
			.attr("value",function(d){ return d[1];})
			.text(function(d){return d[0];});		
})();
	
function downloadfile(filename, text) {
    var pom = document.createElement('a');
    pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    pom.setAttribute('download', filename);

    if (document.createEvent) {
        var event = document.createEvent('MouseEvents');
        event.initEvent('click', true, true);
        pom.dispatchEvent(event);
    }
    else {
        pom.click();
    }
}
var filedownload = filepanel.addEmpty();
filedownload.append("input").attr("type","button")
	.attr("value","Download JSON")
	.on("click",function(){
		view.clearSelection();
		downloadfile("map.json",JSON.stringify(planarmap));

	});
var svgdownload = filepanel.addEmpty()
	.append("input").attr("type","button")
	.attr("value","Download SVG")
	.on("click",function(){
		view.clearSelection();
		var content = d3.select("#pmap").html();
		var div = d3.select("body").append("div")
			.style("display","none")
			.html(content);
		div.select("#zoomgroup").attr("transform",null);
		div.select(".backgroundLayer").remove();
		div.select(".helpLineLayer").remove();
		div.select(".cornerLayer").remove();
		
		// Extract bounding box from original svg.
		// For some reason one cannot do so for an SVG with display:none.
		var rect = d3.select("#pmap .edgelayer").node().getBBox();
		var margin = 5;
		rect.x -= margin;
		rect.y -= margin;
		rect.width += 2*margin;
		rect.height += 2*margin;
		
		if( typeof overrideBBox != 'undefined' ) rect = overrideBBox;
		
		div.select("svg").attr("id","svgcopy")
			.attr("viewBox",rect.x + " " + rect.y + " " + rect.width + " " + rect.height)
			.append("jsondata").text("<!"+"[CDATA[" + 
				JSON.stringify(planarmap) + "]]>");
		
		crowbar.downloadById("svgcopy",
			["stroke","stroke-width","fill"] );	
		div.remove();

	});
filepanel.addEmpty()
	.append("input").attr("type","button")
	.attr("value","Clear (single edge map)")
	.on("click",function(){
		addStateToUndoHistory();
		planarmap.singleEdgeMap();
		view.updateLayers();
		view.updatePositions();
	});

control.addPanel("forcelayout","Force layout",
	true, function(){ force.resume(); })
	.addToggle("Force","Off","On",force.enabled)
	.addSlider("Spring coupling","springcoupling",
		force.springCoupling, 0.2, 10, 0.2)
	.addSlider("Spring length","springlength",
		force.springLength, 0.2, 2.5, 0.1)
	.addSlider("Repulsion power","repulsionpower",
		force.repulsionPower, 0.3, 2, 0.1)
	.addSlider("Centering force","centerpullcoupling",
		force.centerPullCoupling, 0., 5, 0.1)
	.addSlider("Initial stepsize","initialstepsize",
		force.initialStepsize, 0.0005, 0.03, 0.0005)
	.addSlider("Lower threshold","lowerthreshold",
		force.lowerThreshold, 0.0, 0.2, 0.005)	
		;	

function getAllClasses(map) {
	var classes = {};
	function addclass(f){
		for( thisclass in f.class )
		{
			classes[thisclass] = classes[thisclass] || f.class[thisclass];
		}
	}
	map.faces().forEach(addclass);
	map.edges().forEach(addclass);
	map.nodes().forEach(addclass);

	return Object.keys(classes);
}

var classes = getAllClasses(planarmap);
var selectpanel = control.addPanel("select","Selection",true);

selectpanel.addEmpty()
	.append("input").attr("type","button")
	.attr("value","Select none")
	.on("click",function(){
		view.clearSelection();
	}); 
var dropdown = selectpanel.addEmpty()
	.append("select")
	.on("focus",function(){
		classes = getAllClasses(planarmap);
		d3.select(this).selectAll("option.selectoption")
			.data(classes,function(d){ return d;})
			.enter().append("option")
			.attr("class","selectoption")
			.attr("value",function(d){ return d;})
			.text(function(d){return d;});
	})
	.on("change",function(event){
		var selectClass = this.value;
		planarmap.forEach(function(obj){
			if( obj.class[selectClass] )
			{
				view.addToSelection(obj);
			}
		});
		view.updateLayers();
		this.value = "";
		this.blur();
	})
	.append("option")
	.attr("class","selectheader")
	.text("--- Select all of class ---")
	.attr("value","");
	
var setclassDropDown = selectpanel.addEmpty();
setclassDropDown
	.append("input")
	.attr("list","selectclasses")
	.attr("value","Set class ...")
	.on("change",function(event){
		addStateToUndoHistory();
		var classname = this.value;
		view.getSelection().faces.forEach(function(f){
			f.class[classname] = true;
		});
		view.getSelection().edges.forEach(function(e){
			e.class[classname] = true;
		});
		view.getSelection().nodes.forEach(function(n){
			n.class[classname] = true;
		});		
		var selectClass = this.value;
		planarmap.forEach(function(obj){
			if( obj.class[selectClass] )
			{
				view.addToSelection(obj);
			}
		});
		view.updateLayers();
		this.value = "Set class ...";
	})
	.on("focus",function(){
		this.value = "";
		classes = getAllClasses(planarmap);
		var allowedClasses = classes.filter(function(x){
			return ["face","edge","node"].indexOf(x) < 0;
		});
		d3.select("#selectclasses").selectAll("option")
			.data(allowedClasses,function(d){ return d;})
			.enter().append("option")
			.attr("value",function(d){ return d;})
			.text(function(d){return d;});
	})
	.append("datalist")
	.attr("id","selectclasses");
	
selectpanel.addEmpty()
	.append("input").attr("type","button")
	.attr("value","Clear classes of selection")
	.on("click",function(){
		addStateToUndoHistory();
		view.getSelection().faces.forEach(function(f){
			for( var key in f.class ) {
				if(f.class.hasOwnProperty(key) && key != "face" )
				{
					f.class[key] = false;
				}
			}
		});
		view.getSelection().edges.forEach(function(e){
			for( var key in e.class ) {
				if(e.class.hasOwnProperty(key) && key != "edge" )
				{
					e.class[key] = false;
				}
			}
		});
		view.getSelection().nodes.forEach(function(n){
			for( var key in n.class ) {
				if(n.class.hasOwnProperty(key) && key != "node" )
				{
					n.class[key] = false;
				}
			}
		});				
	}); 
	
var fillcolorpicker=selectpanel.addEmpty();
fillcolorpicker
	.append("label")
	.attr("class","colorpicklabel")
	.attr("for","fillcolorpicker")
	.text("Fill:");
fillcolorpicker
	.append("input").attr("type","text")
	.attr("id","fillcolorpicker")
	.attr("class","color");
var strokecolorpicker=selectpanel.addEmpty();
strokecolorpicker
	.append("label")
	.attr("class","colorpicklabel")
	.text("Stroke:")
	.attr("for","strokecolorpicker");
strokecolorpicker	
	.append("input").attr("type","text")
	.attr("id","strokecolorpicker")
	.attr("class","color");
	
selectpanel.addEmpty()
	.append("input").attr("type","button")
	.attr("value","Clear styles of selection")
	.on("click",function(){
		addStateToUndoHistory();
		var clearstyle = function(obj){
			if( obj.attr.style )
			{
				for (var key in obj.attr.style){
					if (obj.attr.style.hasOwnProperty(key)){
						obj.attr.style[key] = null;
						//delete obj.attr.style[key];
					}
				}			
			}
		};
		view.getSelection().faces.forEach(clearstyle);
		view.getSelection().edges.forEach(clearstyle);
		view.getSelection().nodes.forEach(clearstyle);
		view.updateLayers();
	}); 	
	
function selectionStrokeWidth(width)	{
	if (!arguments.length) {
		return 1.0;//view.getSelection()
	}
	view.getSelection().edges.forEach(function(e){
		if( !e.attr.style ) 
		{
			e.attr["style"] = {};
		}
		e.attr.style["stroke-width"] = width;
	});
	view.getSelection().nodes.forEach(function(n){
		if( !n.attr.style ) 
		{
			n.attr["style"] = {};
		}
		n.attr.style["stroke-width"] = width;
	});
	view.updateLayers();
}
selectpanel.addSlider("Stroke-width","strokewidth", selectionStrokeWidth, 0.4, 3.0, 0.1 );
function selectionNodeSize(size)	{
	if (!arguments.length) {
		return 1.0;//view.getSelection()
	}
	view.getSelection().nodes.forEach(function(n){
		n.attr["relativeradius"] = size;
	});
	view.updateLayers();
}
selectpanel.addSlider("Node size","nodesize", selectionNodeSize, 0.2, 3.0, 0.1 );
function selectionStrokeDash(length)	{
	if (!arguments.length) {
		return 1.0;//view.getSelection()
	}
	view.getSelection().edges.forEach(function(e){
		if( !e.attr.style ) 
		{
			e.attr["style"] = {};
		}
    if (length == 0.0)
      e.attr.style["stroke-dasharray"] = '';
    else
      e.attr.style["stroke-dasharray"] = (length*3) + "," + (length*2);
	});
  view.updateLayers();
}
selectpanel.addSlider("Stroke dash","strokedash", selectionStrokeDash, 0.0, 5.0, 0.1 );
	
function OnColorChanged(selectedColor, colorPickerIndex) {
	addStateToUndoHistory();
	view.getSelection().faces.forEach(function(f){
		if( !f.attr.style )
		{
			f.attr.style = {};
		}
		if( colorPickerIndex == 0 ) {
			f.attr.style.fill = selectedColor;
		} else if( colorPickerIndex == 1 ) {
			f.attr.style.stroke = selectedColor;
		}		
	});
	view.getSelection().nodes.forEach(function(n){
		if( !n.attr.style )
		{
			n.attr.style = {};
		}
		if( colorPickerIndex == 0 ) {
			n.attr.style.fill = selectedColor;
		} else if( colorPickerIndex == 1 ) {
			n.attr.style.stroke = selectedColor;
		}
	});
	view.getSelection().edges.forEach(function(e){
		if( !e.attr.style )
		{
			e.attr.style = {};
		}
		if( colorPickerIndex == 0 ) {
		} else if( colorPickerIndex == 1 ) {
			e.attr.style.stroke = selectedColor;
		}
	});
	view.updateLayers();		
}
	
d3.select("body").on("keydown",function(){
  switch (d3.event.key) {
    case "Delete":
      deleteEdge();
      break;
    case "z":
      if (d3.event.ctrlKey) {
        performUndo();
      }
      break;
    case "t":
    case "T":
      sliceMap();
      break;
    case "e":
      createEdge();
      break;
    case "o":
      makeOuter();
      break;
    case "ArrowLeft":
      moveSelection(-1,0);
      break;
    case "ArrowRight":
      moveSelection(1,0);
      break;
    case "ArrowUp":
      moveSelection(0,1);
      break;
    case "ArrowDown":
      moveSelection(0,-1);
      break;
    case "s":
      splitVertexOrEdge();
      break;
    case "m":
      toggleMarker();
      break;
    case "f":
      fixVertices(true);
      break;
    case "u":
      setUnexplored(false);
      break;
    case "U":
      setUnexplored(true);
      break;
    case "r":
      fixVertices(false);
      break;
    case "d":
    case "D":
      drawDual();
      break;
    case "c":
      startContractEdge();
      break;
    case "g":
      startGlueEdges();
      break;
    case "h":
      toggleShowControls();
      break;
    case "p":
      startPeelStep();
      break;
    default:
      if ( d3.event.shiftKey && d3.event.keyCode >= 50 && d3.event.keyCode <= 57 ) // Shift + 2-9
      {
        createLoop(d3.event.keyCode-48);
      } else if ( d3.event.keyCode >= 50 && d3.event.keyCode <= 57 ) // 2-9
      {
        createFace(d3.event.keyCode-48);
      }
    }
});

function copyAttributes(fromObject,toObject)
{
	toObject.class = toObject.class || {};
	for(var key in toObject.class)
	{
		if( toObject.class.hasOwnProperty(key) )
		{
			toObject.class[key] = false;
		}
	}
	for(var key in fromObject.class)
	{
		if( fromObject.class.hasOwnProperty(key) )
		{
			toObject.class[key] = fromObject.class[key];
		}
	}
	toObject.attr.style = toObject.attr.style || {};
	for(var key in toObject.attr.style)
	{
		if( toObject.attr.style.hasOwnProperty(key) )
		{
			toObject.attr.style[key] = null;
		}
	}

	for(var key in fromObject.attr.style)
	{
		if( fromObject.attr.style.hasOwnProperty(key) )
		{
			toObject.attr.style[key] = fromObject.attr.style[key];
		}
	}
	if( fromObject.attr.relativeradius )
	{
		toObject.attr.relativeradius = fromObject.attr.relativeradius;
	}
}

var undoHistory = [];
function performUndo()
{
	if( undoHistory.length > 0 )
	{
		view.clearSelection();
		force.stop();
		planarmap.fromJSON(JSON.parse(undoHistory.pop()));
		planarmap.edges().forEach(function(e){
			e.attr.selected = false;
			e.attr.rightcornerselected = false;
			e.attr.leftcornerselected = false;
		});
		planarmap.faces().forEach(function(f){
			f.attr.selected = false;
		});
		planarmap.nodes().forEach(function(n){
			n.attr.selected = false;
		});	
		view.updateLayers(true);
		view.updatePositions();		
		force.resume();
	}
}
function addStateToUndoHistory()
{
	undoHistory.push( JSON.stringify(planarmap) );
}

function toggleShowControls()
{
	var list = document.getElementById("controllist");
    list.style.display = (list.style.display == "none") ? "block" : "none";
}

function moveSelection(alongface,alongvertex)
{
	var selection = view.getSelection();
  if( selection.faces.length == 0 &&
		selection.nodes.length == 0 &&
		selection.edges.length == 0 &&
		selection.corners.length == 2 )
	{
		var corner0 = selection.corners[0];
		var corner1 = selection.corners[1];
		view.clearSelection();
		if( d3.event.shiftKey )
		{
			view.addToSelection(corner0);
		}
		if( alongface == 1 )
		{
			view.addToSelection(corner1.next());
		}
		if( alongface == -1 )
		{
			view.addToSelection(corner1.prev());
		}
		if( alongvertex == -1 )
		{
			view.addToSelection(corner1.reverse().next());
		}
		if( alongvertex == 1 )
		{
			view.addToSelection(corner1.prev().reverse());
		}		
		view.updateLayers();
	}	else if( selection.corners.length >= 1 )
	{
		var corner = selection.corners.at(-1);
		if( !d3.event.shiftKey )
		{
			view.clearSelection();
		}
		if( alongface == 1 )
		{
			view.addToSelection(corner.next());
		}
		if( alongface == -1 )
		{
			view.addToSelection(corner.prev());
		}
		if( alongvertex == -1 )
		{
			view.addToSelection(corner.reverse().next());
		}
		if( alongvertex == 1 )
		{
			view.addToSelection(corner.prev().reverse());
		}		
		view.updateLayers();
	}	else if( selection.faces.length >= 1 )
	{
		var selectcorner = getRandomElement(getRandomElement(selection.faces).edges);
		view.clearSelection();
		view.addToSelection(selectcorner);
		view.updateLayers();
	}	else if( selection.edges.length >= 1 )
	{
		var selectcorner = getRandomElement(selection.edges).getOriented();
		view.clearSelection();
		view.addToSelection(selectcorner);
		view.updateLayers();
	}	else if( selection.nodes.length >= 1 )
	{
		var selectcorner = getRandomElement(getRandomElement(selection.nodes).edges);
		view.clearSelection();
		view.addToSelection(selectcorner);
		view.updateLayers();
	} else 
  {
		view.addToSelection(getRandomElement(planarmap.outerface().edges));
		view.updateLayers();
	}
}

function createEdge()
{
	var selection = view.getSelection();
	if( selection.faces.length == 0 &&
		selection.nodes.length == 0 &&
		selection.edges.length == 0 )	
	{
		if( selection.corners.length == 1 )
		{
			addStateToUndoHistory();
			var edge = selection.corners[0];
			view.clearSelection();
			var newedge = planarmap.insertEdgeNextTo(edge);
			copyAttributes(edge.edge,newedge);
			copyAttributes(newedge.start,newedge.end);
      view.addToSelection(newedge);
		} else if( selection.corners.length == 2 
			&& selection.corners[0].left() ==
			   selection.corners[1].left() )
		{
			addStateToUndoHistory();
			var edge1 = selection.corners[0],
				edge2 = selection.corners[1];
			view.clearSelection();
			var edge = planarmap.insertDiagonal(edge1.left(),[edge1,edge2]);
			copyAttributes(edge.left,edge.right);
			copyAttributes(edge1.edge,edge);
      view.addToSelection(edge);
		}
		view.updateLayers();
		view.updatePositions();
	}	
}

function swapEdge(edge)
{
  var cornerend = edge.getOriented(!edge.left.layout.outer);
  var cornerstart = cornerend.next();
  var savedattributes = new CMap.Face();
  if( edge.left.layout.outer)
    copyAttributes(edge.right, savedattributes);
  else
    copyAttributes(edge.left, savedattributes);

  comments = {};
  comments.outer="left";
  var newedge = planarmap.insertDiagonal(planarmap.outerface(),
      [cornerstart,cornerend], comments);
  copyAttributes(planarmap.outerface(), newedge.right);
  copyAttributes(edge,newedge);
  planarmap.removeEdge(edge);
  copyAttributes(savedattributes, planarmap.outerface());
  savedattributes.clear();
  delete savedattributes;
  return newedge;
}
function borderFaceToOuter(face)
{
  let maxEdgeSegments = -1, maxLength = 0, bestEdge = null;
  face.edges.forEach(oEdge => {
    if( oEdge.right().layout.outer && (
      oEdge.edge.layout.vert.length > maxEdgeSegments ||
      (oEdge.edge.layout.vert.length == maxEdgeSegments && CMap.edgeLength(oEdge.edge) > maxLength))
    ) {
      bestEdge = oEdge.edge;
      maxEdgeSegments = bestEdge.layout.vert.length;
      maxLength = CMap.edgeLength(bestEdge);
    }})
  if (bestEdge == null)
    throw "Face is not on border";
  return swapEdge(bestEdge).left;
}

function faceToOuter(face, timeout)
{
  timeout = defaultFor(timeout, 200);
  let distLabel = "distFromNewOuter";
  CMap.dualGraphDistance(planarmap, face, distLabel);

  let actuFace = planarmap.outerface();
  timeoutActu = timeout/20;
  while (actuFace.attr[distLabel] > 0) {
    actuFace = actuFace.edges.find(orEdge => (orEdge.right().attr[distLabel] < actuFace.attr[distLabel])).right();
    setTimeout(face => {
      borderFaceToOuter(face); 
      view.updateLayers();
      view.updatePositions();
    }, timeoutActu, actuFace);
    timeoutActu += timeout;
  }
}

function makeOuter()
{
	var selection = view.getSelection();
	if( selection.faces.length == 0 &&
		selection.nodes.length == 0 &&
		selection.edges.length == 1 &&
    selection.corners.length == 0 )
  {
    var edge = selection.edges[0];
    if( !edge.left.layout.outer && !edge.right.layout.outer) return;
    addStateToUndoHistory();
    view.clearSelection();
    
    edge = swapEdge(edge);

    view.addToSelection(edge);
		
		view.updateLayers();
		view.updatePositions();
	}	
	if(( selection.faces.length == 1 &&
		selection.nodes.length == 0 &&
		selection.edges.length == 0 &&
    selection.corners.length == 0 ) ||
    ( selection.faces.length == 0 &&
    selection.nodes.length == 0 &&
    selection.edges.length == 0 &&
    selection.corners.length == 1 ))
  {
    if (selection.faces.length == 1)
      var face = selection.faces[0];
    else
      var face = selection.corners[0].left();
    addStateToUndoHistory();
    view.clearSelection();
    
    faceToOuter(face);
		
		view.updateLayers();
		view.updatePositions();
	}	
	if( selection.faces.length == 1 &&
		selection.nodes.length == 0 &&
		selection.edges.length == 0 &&
    selection.corners.length == 0 )
  {
    var face = selection.faces[0];
    addStateToUndoHistory();
    view.clearSelection();
    
    faceToOuter(face);
		
		view.updateLayers();
		view.updatePositions();
	}	
}

function splitVertexOrEdge()
{
	var selection = view.getSelection();
	if( selection.faces.length == 0 &&
		selection.nodes.length == 0 &&
		selection.corners.length == 0 &&
		selection.edges.length == 1 )	
	{
		var splitedge = selection.edges[0].getOriented();
		view.clearSelection();
		addStateToUndoHistory();
		planarmap.splitEdge(splitedge);
		copyAttributes(splitedge.edge,splitedge.next().edge);
		copyAttributes(splitedge.start(),splitedge.end());
    view.addToSelection(splitedge.next().edge);
		view.updateLayers();
		view.updatePositions();
	} else if( selection.faces.length == 0 &&
		selection.nodes.length == 0 &&
		selection.corners.length == 2 &&
		selection.edges.length == 0 )	
	{
		if( selection.corners[0].start() ==
			selection.corners[1].start() )
		{
			var corner1 = selection.corners[0],
				corner2 = selection.corners[1];
			view.clearSelection();
			addStateToUndoHistory();
			var newedge = planarmap.splitVertex([corner1,corner2]);
			copyAttributes(newedge.getOriented().prev().edge,newedge);
			copyAttributes(newedge.start,newedge.end);
      view.addToSelection(newedge);
			view.updateLayers();
			view.updatePositions();
		}
	}	
}

function sliceMap()
{
	var selection = view.getSelection();
	if( selection.faces.length == 0 &&
		selection.nodes.length == 1 &&
		selection.edges.length == 1 &&
    selection.corners.length == 0 )
  {
    let baseEdge = selection.edges[0];
    let apexNode = selection.nodes[0];
    addStateToUndoHistory();
    view.clearSelection();
    
    CMap.slice(planarmap, baseEdge, apexNode, d3.event.shiftKey);

    view.nodeText(node => node.attr["distancefromsliceapex"]);
		
		view.updateLayers();
		view.updatePositions();
	}	
}

function deleteEdge()
{
	var selection = view.getSelection();
	if( selection.faces.length == 0 &&
		selection.nodes.length == 0 &&
		selection.corners.length == 0 &&
		selection.edges.length == 1 )
	{
		var edge = selection.edges[0];
		if( !(edge.start.edges.length > 1 && edge.end.edges.length > 1
			&& edge.left == edge.right) && planarmap.numEdges() > 1 )
		{
			view.clearSelection();
			addStateToUndoHistory();
			planarmap.removeEdge(edge);
			view.updateLayers();
			view.updatePositions();
		}
	}
	if( selection.faces.length == 1 &&
		selection.nodes.length == 0 &&
		selection.corners.length == 0 &&
		selection.edges.length == 0 )
	{
		var face = selection.faces[0];
		var outeredges = face.edges.filter(function(e){ return e.right().layout && e.right().layout.outer; });		
		var nextdelete;
		while( (nextdelete = outeredges.filter(function(e) {
				return (e.start().edges.length == 1 || e.end().edges.length == 1
					|| e.left() != e.right() ) && planarmap.numEdges() > 1;
			})).length > 0 )
		{
			outeredges.splice(outeredges.indexOf(nextdelete[0]),1);
			planarmap.removeEdge(nextdelete[0].edge);
		}
		view.updateLayers();
		view.updatePositions();
	}
}

function toggleMarker()
{
	var selection = view.getSelection();
	if( selection.faces.length == 0 &&
		selection.nodes.length == 0 &&
		selection.corners.length > 0 &&
		selection.edges.length == 0 )
	{
		addStateToUndoHistory();
		selection.corners.forEach(function(oredge){
			if( !oredge.edge.attr.marker )
			{
				oredge.edge.attr.marker = {};
			}
			if( !oredge.reversed )
			{
				if( !oredge.edge.attr.marker.start || oredge.edge.attr.marker.start != "arrow" )
				{
					oredge.edge.attr.marker.start = "arrow";
				} else
				{
					oredge.edge.attr.marker.start = "";
				}
			} else
			{
				if( !oredge.edge.attr.marker.end || oredge.edge.attr.marker.end != "arrow" )
				{
					oredge.edge.attr.marker.end = "arrow";
				} else
				{
					oredge.edge.attr.marker.end = "";
				}
			}		
		});
		view.updateLayers();
	}
}

function fixVertices(fix)
{
	var selection = view.getSelection();
	if( selection.faces.length == 0 &&
		selection.nodes.length > 0 &&
		selection.corners.length == 0 &&
		selection.edges.length == 0 )
	{
		addStateToUndoHistory();
		selection.nodes.forEach(function(node){
			if( !node.layout )
			{
				node.layout = {};
			}
			node.layout.fixed = fix;
		});
		view.updateLayers();
	}
}

function drawDual()
{
	addStateToUndoHistory();
	var selection = view.getSelection();
	if( selection.faces.length > 0 )
	{
		CMap.addPartialDualMap(planarmap,selection.faces);
	} else {
		CMap.addDualMap(planarmap,d3.event.shiftKey);
	}
	view.clearSelection();
	planarmap.edges().forEach(function(edge){
		if( edge.start.class["intersection"] || edge.end.class["intersection"] )
		{
			edge.layout.relSpringLength = 0.5;
			edge.layout.relRepulsionStrength = 0.5;
		}
	})
	view.updateLayers();
	view.updatePositions();	
}

function createFace(degree)
{
	var selection = view.getSelection();
	if( selection.faces.length == 0 &&
		selection.nodes.length == 0 &&
		selection.corners.length == 1 &&
		selection.edges.length == 0 )
	{
		
		addStateToUndoHistory();
		var corners = [selection.corners[0], selection.corners[0].next()];
		view.clearSelection();
		var comment = {};
		if( corners[0].left().layout.outer )
		{
			comment["outer"] = corners[0].isEqual(corners[1]) ? "right" : "left";
		}
		var newedges = [
			planarmap.insertDiagonal(corners[0].left(),
				[corners[0],corners[1]],comment)
		];
		copyAttributes(corners[0].edge,newedges[0]);
		copyAttributes(corners[0].right(),corners[0].left());
		corners[0].left().class["loopface"] = false;
		
		while( newedges.length + 1 < degree )
		{
			var longestedge;
			var longestlength = 0.0;
			newedges.forEach(function(edge){
				var length = CMap.edgeLength(edge);
				if( length > longestlength )
				{
					longestlength = length;
					longestedge = edge;
				}
			});
			planarmap.splitEdge(longestedge.getOriented());
			copyAttributes(longestedge,longestedge.getOriented().next().edge);
			copyAttributes(longestedge.start,longestedge.end);
			newedges.push( longestedge.getOriented().next().edge );
		}
		view.updateLayers();
		view.updatePositions();		
	}
}

function setUnexplored(pointed)
{
	var selection = view.getSelection();
	if( selection.faces.length > 0 || selection.corners.length > 0 )
	{
		addStateToUndoHistory();
		selection.faces.forEach(function(face){
			face.class["unexplored"] = true;
			face.class["pointed"] = pointed;
		});
		selection.corners.forEach(function(edge){
			edge.left().class["unexplored"] = true;
			edge.left().class["pointed"] = pointed;
		});
		view.clearSelection();
		view.updateLayers();
	}

}

function createLoopInFace(face)
{
	var corners = face.edges.slice();
	corners.forEach(function(edge){
		var loopedge = planarmap.insertEdgeNextTo(edge);
		loopedge.class["loopedge"] = true;
		loopedge.layout["relSpringLength"] = 0.05;
		loopedge.layout["relSpringCoupling"] = 8.0;
	});
	corners.forEach(function(edge){
		planarmap.insertDiagonal(edge.left(),[edge.prev(),edge.next(2)]);
		edge.left().class["loopface"] = true;
	});

}

function createLoop(degree)
{
	var selection = view.getSelection();
	if( selection.faces.length == 0 &&
		selection.nodes.length == 0 &&
		selection.corners.length == 1 &&
		selection.edges.length == 0 )
	{
		addStateToUndoHistory();
		var corner = selection.corners[0];
		var face = corner.left();
		createFace(degree);
		
		setTimeout(function(){
			createLoopInFace(corner.left());
			copyAttributes(face,corner.prev(2).right());
			view.updateLayers();
			view.updatePositions();	
		},200);
	}
}

function createLoop2(degree)
{
	var selection = view.getSelection();
	if( selection.faces.length == 0 &&
		selection.nodes.length == 0 &&
		selection.corners.length == 1 &&
		selection.edges.length == 0 )
	{
		
		addStateToUndoHistory();
		var corners = [selection.corners[0], selection.corners[0].next()];
		view.clearSelection();
		var comment = {};
		if( corners[0].left().layout.outer )
		{
			comment["outer"] = corners[0].isEqual(corners[1]) ? "right" : "left";
		}
		var newedges = [
			planarmap.insertDiagonal(corners[0].left(),
				[corners[0],corners[1]],comment)
		];
		copyAttributes(corners[0].edge,newedges[0]);
		copyAttributes(corners[0].right(),corners[0].left());
		
		while( newedges.length + 1 < degree )
		{
			var longestedge;
			var longestlength = 0.0;
			newedges.forEach(function(edge){
				var length = CMap.edgeLength(edge);
				if( length > longestlength )
				{
					longestlength = length;
					longestedge = edge;
				}
			});
			planarmap.splitEdge(longestedge.getOriented());
			copyAttributes(longestedge,longestedge.getOriented().next().edge);
			copyAttributes(longestedge.start,longestedge.end);
			newedges.push( longestedge.getOriented().next().edge );
			var loopedge = planarmap.insertEdgeNextTo(longestedge.getOriented(true));
			loopedge.class["loopedge"] = true;
			loopedge.layout["relSpringLength"] = 0.1;
			loopedge.layout["relSpringCoupling"] = 5.0;
		}
		loopedge = planarmap.insertEdgeNextTo(corners[0].next());
		loopedge.class["loopedge"] = true;
		loopedge.layout["relSpringLength"] = 0.1;
		loopedge.layout["relSpringCoupling"] = 5.0;
		loopedge = planarmap.insertEdgeNextTo(corners[0]);
		loopedge.class["loopedge"] = true;
		loopedge.layout["relSpringLength"] = 0.1;
		loopedge.layout["relSpringCoupling"] = 5.0;
		
		var corner = corners[0].prev();
		for(var i=0;i<degree;i++)
		{
			planarmap.insertDiagonal(corner.left(),[corner,corner.prev(3)]);
			corner = corner.prev();
			corner.right().class["loopface"] = true;
		}
		
		view.updateLayers();
		view.updatePositions();		
	}
}

function startContractEdge()
{
	var selection = view.getSelection();
	if( selection.faces.length == 0 &&
		selection.nodes.length == 0 &&
		selection.corners.length == 0 &&
		selection.edges.length == 1 )
	{
		var edge = selection.edges[0];
		
		// make sure it's not a loop
		if( edge.start != edge.end )
		{
			addStateToUndoHistory();
			view.clearSelection();
			// use force to contract edge a bit
			edge.layout["relSpringLength"] = 0.05;
			edge.layout["relSpringCoupling"] = 8.0;
			force.resume();
			
			// then perform contraction after delay
			setTimeout(function(){
				contractEdge(edge.getOriented());
			},400);
		}
	}
}

function contractEdge(orientededge)
{
	var contractleft = true;
	while( !orientededge.isReverse( orientededge.prev() ) )
	{
		// reroute edges alternatingly on the left and the right to
		// avoid too much twisting/torque
		if( contractleft )
		{
			var nextedge = orientededge.prev();
			var comment = {};
			if( nextedge.left().layout.outer )
			{
				if( orientededge.next().isEqual(nextedge) )
				{
					// by convention when a loop is inserted the 
					// degree-1 face is on its right, and this one 
					// should be the outer face
					comment["outer"] = "right";
				} else
				{
					comment["outer"] = "left";
				}
			}
			var newedge = planarmap.insertDiagonal(nextedge.left(),
				[nextedge,orientededge.next()],comment);
			copyAttributes(nextedge.edge,newedge);
			transferMarker(nextedge,newedge.getOriented());
			copyAttributes(newedge.left,newedge.right);
			copyAttributes(nextedge.right(),nextedge.left());
			planarmap.removeEdge(nextedge.edge);
		} else
		{
			var nextedge = orientededge.reverse().next();
			var comment = {};
			if( nextedge.left().layout.outer )
			{
				comment["outer"] = "right";
			}
			var newedge = planarmap.insertDiagonal(nextedge.left(),
				[nextedge.next(),nextedge.prev()],comment);
			copyAttributes(newedge.left,newedge.right);
			copyAttributes(nextedge.edge,newedge);
			transferMarker(nextedge,newedge.getOriented(true));
			copyAttributes(nextedge.right(),newedge.left);
			planarmap.removeEdge(nextedge.edge);	
		}
		contractleft = !contractleft;
	}
	planarmap.removeEdge(orientededge.edge);
		
	view.updateLayers();
	view.updatePositions();		
}

function filterInPlace(a, condition) {
  var i = 0, j = 0;

  while (i < a.length) {
    const val = a[i];
    if (condition(val, i, a)) a[j++] = val;
    i++;
  }

  a.length = j;
  return a;
}

function transferMarker(fromEdge, toEdge)
{
	if( fromEdge.edge.attr.marker )
	{
		toEdge.edge.attr.marker = toEdge.edge.attr.marker || {};
		if( fromEdge.edge.attr.marker.start &&
			fromEdge.edge.attr.marker.start != "" )
		{
			toEdge.edge.attr.marker[ 
				fromEdge.reversed == toEdge.reversed ? "start" : "end" ]
				= fromEdge.edge.attr.marker.start;
		}
		if( fromEdge.edge.attr.marker.end &&
			fromEdge.edge.attr.marker.end != "" )
		{
			toEdge.edge.attr.marker[ 
				fromEdge.reversed == toEdge.reversed ? "end" : "start" ]
				= fromEdge.edge.attr.marker.end;
		}
	}
}

function startGlueEdges()
{
	var selection = view.getSelection();
	var edgepairs = [];
	if( selection.faces.length == 0 &&
		selection.nodes.length == 0 &&
		selection.corners.length == 2 &&
		selection.edges.length == 0 )
	{
		edgepairs.push([selection.corners[0],selection.corners[1]]);
	}
	if( selection.faces.length == 0 &&
		selection.nodes.length == 0 &&
		selection.corners.length == 1 &&
		selection.edges.length == 0 )
	{
		edgepairs.push([selection.corners[0],selection.corners[0].prev()]);
	}				
	if( selection.edges.length == 2 )
	{
		edgepairs.push([selection.edges[0].getOriented(),selection.edges[1].getOriented()]);
		edgepairs.push([selection.edges[0].getOriented(true),selection.edges[1].getOriented()]);		
		edgepairs.push([selection.edges[0].getOriented(),selection.edges[1].getOriented(true)]);
		edgepairs.push([selection.edges[0].getOriented(true),selection.edges[1].getOriented(true)]);
	}				
	if( selection.faces.length == 1 && selection.edges.length == 2 )
	{
		filterInPlace(edgepairs,function(p){ return p[0].left() == selection.faces[0]; });
	}	
	if( selection.corners.length >= 1 && selection.edges.length == 2 )
	{
		filterInPlace(edgepairs,function(p){ return p[0].left() == selection.corners[0].left(); });
	}
	filterInPlace(edgepairs,function(p){ 
		return (p[0].left() == p[1].left())
			&& !p[0].isReverse(p[1])
			&& p[0] != p[1]
			&& (p[0].start() != p[1].end() || p[0].prev().isEqual(p[1]))
			&& (p[1].start() != p[0].end() || p[1].prev().isEqual(p[0]))
			&& (!p[0].left().layout.outer || p[0].left().edges.length > 2); 
	});
	if( edgepairs.length == 1 )
	{
		addStateToUndoHistory();
		view.clearSelection();
		var edges = edgepairs[0];
		var comment = {};
		if( edges[0].left().layout.outer )
		{
			edges[0].left().class["hole"] = true;
			if( edges[0].next().isEqual(edges[1]) )
			{
				comment["outer"] = "left";
			} else if( edges[1].next().isEqual(edges[0]) )
			{
				comment["outer"] = "right";
			} else
			{
				// here we need to do something extra to decide
				comment["outer"] = "left";
			}
		}
		if( !edges[0].next().isEqual(edges[1]) )
		{
			var tempedge0 = planarmap.insertDiagonal(edges[0].left(),
				[edges[0].next(),edges[1]],comment);
			copyAttributes(tempedge0.left,tempedge0.right);
			tempedge0.class["contract"] = true;
			tempedge0.layout["relSpringLength"] = 0.05;
			tempedge0.layout["relSpringCoupling"] = 12.0;
		}
		if( !edges[1].next().isEqual(edges[0]) )
		{
			var tempedge1 = planarmap.insertDiagonal(edges[1].left(),
				[edges[0],edges[1].next()],comment);
			copyAttributes(tempedge1.left,tempedge1.right);
			tempedge1.class["contract"] = true;
			tempedge1.layout["relSpringLength"] = 0.05;
			tempedge1.layout["relSpringCoupling"] = 12.0;
		}
		view.updateLayers();
		view.updatePositions();	
		force.resume();
	
		// then perform contraction after delay
		setTimeout(function(){
			copyAttributes(edges[1].right(),edges[1].left());
			transferMarker(edges[1],edges[0].reverse());
			planarmap.removeEdge(edges[1].edge);
			if( tempedge0 )
			{
				contractEdge(tempedge0.getOriented());
			}
			if( tempedge1 )
			{
				contractEdge(tempedge1.getOriented());
			}
			//planarmap.removeEdge(edges[0].edge);
			//console.assert( planarmap.checkIncidence());
			view.updateLayers();
			view.updatePositions();	
		},600);
		
	}		
}

function randomQuadStep(l,type)
{
	var uniform = Math.random();
	
	if( type === "infinite" )
	{
		uniform -= (2.0 / 3) * (1 + 1.0 / (2*l) );
		if( uniform <= 0.0 )
		{
			return l+1;
		}
		var nextprob = -1.0;
		for( var k=1;k<l-1;k++ )
		{
			nextprob *= (2*k-3)/(k+1.0);
			nextprob *= (l-k)/(2*(l-k)+1.0);
			uniform -= nextprob;
			if( uniform <= 0.0 )
			{
				return l-k;
			}
		}
		return 1;
	} else if( type === "unpointed" )
	{
		uniform -= (1.0+2*l)/(3.0+l)/3;
		if( uniform <= 0.0 )
		{
			return l+1;
		}
		var nextprob = -0.5;
		for( var k=1;k<l;k++ )
		{
			nextprob *= (2*k-3)/(k+1.0);
			nextprob *= (l-k+3)/(2*(l-k)+1.0);
			uniform -= nextprob;
			if( uniform <= 0.0 )
			{
				return l-k;
			}
		}
		return 0;
	} else if( type === "pointed" )
	{
		uniform -= (1.0+2*l)/(1.0+l)/3;
		if( uniform <= 0.0 )
		{
			return l+1;
		}
		var nextprob = -1.0;
		for( var k=1;k<l;k++ )
		{
			nextprob *= (2*k-3)/(k+1.0);
			nextprob *= (l-k+1)/(2*(l-k)+1.0);
			uniform -= nextprob;
			if( uniform <= 0.0 )
			{
				return l-k;
			}
		}
		return 0;
	}
}

function startPeelStep()
{
	var peeledge;
	var selection = view.getSelection();
	if( selection.faces.length == 0 &&
		selection.nodes.length == 0 &&
		selection.corners.length == 0 &&
		selection.edges.length == 0 )
	{
		var unexploredfaces = planarmap.faces().array().filter(function(f){
			return !f.hasOwnProperty("unexplored") && f.class["unexplored"];
		});
		if( unexploredfaces.length == 0 )
		{
			var peelface = planarmap.outerface();
		} else
		{
			peelface = getRandomElement(unexploredfaces);
		}
		peeledge = getRandomElement(peelface.edges);
	} else if( selection.faces.length == 1 &&
		selection.nodes.length == 0 &&
		selection.corners.length == 0 &&
		selection.edges.length == 0 )
	{
		peeledge = getRandomElement(selection.faces[0].edges);
	} else if( selection.faces.length == 0 &&
		selection.nodes.length == 0 &&
		selection.corners.length == 1 &&
		selection.edges.length == 0 )
	{
		peeledge = selection.corners[0];
	} else
	{
		return;
	}
	if( peeledge.left().edges.length % 2 != 0 )
	{
		// only even degree holes for now
		return;
	}
	view.clearSelection();
	
	var curperim = peeledge.left().edges.length;
	var type = peeledge.left().layout.outer ? "infinite" : "unpointed";
	if( peeledge.left().class["pointed"] ) type = "pointed";
	var nextperim = 2 * randomQuadStep(curperim/2, type);
	
	if( nextperim >= curperim )
	{
		view.addToSelection(peeledge);
		createFace(nextperim - curperim + 2);
	} else if( nextperim <= curperim - 2 )
	{
		if( Math.random() < 0.5 )
		{
			// to the left
			var glueedge = peeledge.prev( curperim - nextperim - 1);
			view.addToSelection( glueedge );
			view.addToSelection( peeledge );
			startGlueEdges();
			
			if( type == "pointed" )
			{
				peeledge.left().class["pointed"] = false;
				if( nextperim > 0 )
				{
					peeledge.next().right().class["pointed"] = true;
				} else
				{
					peeledge.end().class["pointed"] = true;
				}
				if( nextperim < curperim - 2 )
				{
					peeledge.prev().right().class["pointed"] = false;
				}
			}
		} else
		{
			// to the right
			var glueedge = peeledge.next( curperim - nextperim - 1);
			view.addToSelection( peeledge );
			view.addToSelection( glueedge );
			startGlueEdges();	

			if( type == "pointed" )
			{
				peeledge.left().class["pointed"] = false;	
				if( nextperim > 0 )
				{
					peeledge.prev().right().class["pointed"] = true;
				} else
				{
					peeledge.start().class["pointed"] = true;
				}
				if( nextperim < curperim - 2 )
				{
					peeledge.next().right().class["pointed"] = false;
				}
			}
		}
	}
}
