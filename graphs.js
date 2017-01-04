

// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014

var graphs = SAGE2_App.extend({
    construct: function ()
    {
        log("construct");
        arguments.callee.superClass.construct.call(this);
        this.resizeEvents = "onfinish";

        this.ctx = null;
        this.graph = null;
        // Node structure: "label","x","y","id","attributes","color","size"
        // Fast Edge structure: "source", "target", "color", "size"
        // source/target structure: id, x, y
        this.fastGraph = { nodes: [], edges: [] };
        this.dragMode = false;
        this.dragUsed = false;
        this.mouse = { x: 0, y: 0 };
        this.lastDate = new Date();
        this.lastEdgeColor = null;
        this.lastNodeColor = null;
        this.lastEdgeWidth = null;
        this.maximumNodeSize = 0;
        this.minimumNodeSize = Infinity;
        this.labelSizeTreshold = 100;
        this.maximumEdgeSize = 0;
        this.minimumEdgeSize = Infinity;
        this.edgeSizeTreshold = 10;
        this.nodeSizeTreshold = 10;
        this.zoomStep = 0.05;
        this.visibleNodesCount = 0;
        this.visibleEdgesCount = 0;
        this.selectedNodeId = -1;
        this.selectableNodes = [];
        this.idMap = null;
        this.colorMode = true;
        this.nodeRenderSizeMultiplier = 50;
        this.edgeRenderSizeMultiplier = 1;
        this.version = 1.06;
    },

    findCenter: function (graph)
    {
        minX = graph.nodes[0].x;
        minY = graph.nodes[0].y;
        maxX = graph.nodes[0].x;
        maxY = graph.nodes[0].y;
        for (i = 1; i < graph.nodes.length; i++)
        {
            if (graph.nodes[i].x < minX)
                minX = graph.nodes[i].x;
            if (graph.nodes[i].y < minY)
                minY = graph.nodes[i].y;
            if (graph.nodes[i].x > maxX)
                maxX = graph.nodes[i].x;
            if (graph.nodes[i].y > maxY)
                maxY = graph.nodes[i].y;
        }
        return { x: (maxX + minX) / 2.0, y: (maxY + minY) / 2.0 };
    },

    translateGraph: function (graph, vector)
    {
        for (i = 0; i < graph.nodes.length; i++)
        {
            graph.nodes[i].x -= vector.x;
            graph.nodes[i].y -= vector.y;
        }
        for (i = 0; i < graph.edges.length; i++)
        {
            graph.edges[i].source.x -= vector.x;
            graph.edges[i].source.y -= vector.y;
            graph.edges[i].target.x -= vector.x;
            graph.edges[i].target.y -= vector.y;
        }
    },

    scaleGraph: function (graph, scale)
    {
        for (i = 0; i < graph.nodes.length; i++)
        {
            graph.nodes[i].x *= scale;
            graph.nodes[i].y *= scale;
        }
        for (i = 0; i < graph.edges.length; i++)
        {
            graph.edges[i].source.x *= scale;
            graph.edges[i].source.y *= scale;
            graph.edges[i].target.x *= scale;
            graph.edges[i].target.y *= scale;
        }
    },

    invertGraphYAxis: function (graph)
    {
        for (i = 0; i < graph.nodes.length; i++)
        {
            graph.nodes[i].y = -graph.nodes[i].y;
        }
        for (i = 0; i < graph.edges.length; i++)
        {
            graph.edges[i].source.y = -graph.edges[i].source.y;
            graph.edges[i].target.y = -graph.edges[i].target.y;
        }
    },

    isVisibleNode: function (node)
    {
        if (node.x > 0 && node.x < this.element.width && node.y > 0 && node.y < this.element.height)
            return true;
        return false;
    },

    isVisibleEdge: function (edge)
    {
        return this.isVisibleNode(edge.source) || this.isVisibleNode(edge.target)
    },

    getHexColor: function (color)
    {
        var rgb = color.match(/\d+/g);
        return "#" + parseInt(rgb[0], 10).toString(16) + parseInt(rgb[1], 10).toString(16) + parseInt(rgb[2], 10).toString(16);
    },

    getVisibleNodesCount: function (graph)
    {
        var count = 0;
        selectableNodes = null;

        for (i = 0; i < graph.nodes.length; i++)
        {
            if (this.isVisibleNode(graph.nodes[i]))
            {
                this.selectableNodes[count] = graph.nodes[i];
                count++;
            }
        }
        //log("selectableNodes: " + this.selectableNodes);
        return count;
    },

    getVisibleEdgesCount: function (graph)
    {
        var count = 0;
        for (i = 0; i < graph.edges.length; i++)
        {
            if (this.isVisibleEdge(graph.edges[i]))
                count++;
        }
        //log("count of visible edges: " + count);
        return count;
    },

    updateNeighbours: function (nodeId)
    {
        log("update neighbours");
        // reset all nodes
        for (i = 0; i < this.fastGraph.nodes.length; i++)
        {
            this.fastGraph.nodes[i].neighbourIsSelected = false;
        }

        if (nodeId == -1)
        {
            return;
        }

        // update neighbours
        for (i = 0; i < this.fastGraph.edges.length; i++)
        {
            if (this.fastGraph.edges[i].source.id === nodeId)
            {
                this.fastGraph.nodes[this.idMap.get(this.fastGraph.edges[i].target.id)].neighbourIsSelected = true;
            }
            else if (this.fastGraph.edges[i].target.id === nodeId)
            {
                this.fastGraph.nodes[this.idMap.get(this.fastGraph.edges[i].source.id)].neighbourIsSelected = true;
            }
        }
    },

    listContainsNode: function (list, nodeId)
    {
        //log("checking for neighbours");
        //for (i = 0; i < list.length; i++)
        //{
        //    log("list node: " + list[i]);
        //    if (list[i] === nodeId)
        //    {
        //        log("node found");
        //        return true;
        //    }
        //}
        //log("node not found");
        return true;
    },

    open: function ()
    {

    },

    openFile: function (text)
    {
        this.graph = null;
        this.fastGraph = { nodes: [], edges: [] };

        var _this = this;

        readFile(this.resrcPath + text + ".json", function (err, text)
        {
            log("readFile");
            _this.parseFile(text);
        });
    },

    parseFile: function (text)
    {
        var _this = this;
        _this.graph = JSON.parse(text);

        this.idMap = new Map();
        _this.fastGraph.nodes = _this.graph.nodes;

        for (i = 0; i < _this.fastGraph.nodes.length; i++)
        {
            _this.fastGraph.nodes[i].neighbourIsSelected = false;
            this.idMap.set(_this.fastGraph.nodes[i].id, i);

            if (this.fastGraph.nodes[i].size > this.maximumNodeSize)
            {
                this.maximumNodeSize = this.fastGraph.nodes[i].size;
            }

            if (this.fastGraph.nodes[i].size < this.minimumNodeSize)
            {
                this.minimumNodeSize = this.fastGraph.nodes[i].size;
            }
            //_this.fastGraph.nodes[i].color = _this.getHexColor(_this.fastGraph.nodes[i].color);
        }

        log("max: " + this.maximumNodeSize);
        log("min: " + this.minimumNodeSize);

        for (i = 0; i < _this.graph.edges.length; i++)
        {
            sourceIndex = this.idMap.get(_this.graph.edges[i].source);
            targetIndex = this.idMap.get(_this.graph.edges[i].target);
            source = { id: _this.graph.edges[i].source, x: _this.fastGraph.nodes[sourceIndex].x, y: _this.fastGraph.nodes[sourceIndex].y };
            target = { id: _this.graph.edges[i].target, x: _this.fastGraph.nodes[targetIndex].x, y: _this.fastGraph.nodes[targetIndex].y };
            //var c = _this.getHexColor(_this.graph.edges[i].color);
            _this.fastGraph.edges[i] = { source: source, target: target, color: _this.graph.edges[i].color, size: _this.graph.edges[i].size };

            if (this.fastGraph.edges[i].size > this.maximumEdgeSize)
            {
                this.maximumEdgeSize = this.fastGraph.edges[i].size;
            }

            if (this.fastGraph.edges[i].size < this.minimumEdgeSize)
            {
                this.minimumEdgeSize = this.fastGraph.edges[i].size;
            }
        }

        log("e max: " + this.maximumEdgeSize);
        log("e min: " + this.minimumEdgeSize);

        _this.invertGraphYAxis(_this.fastGraph);
        _this.scaleGraph(_this.fastGraph, 0.3);
        center = _this.findCenter(_this.fastGraph);
        vector = { x: center.x - _this.element.width / 2.0, y: center.y - _this.element.height / 2.0 };
        _this.translateGraph(_this.fastGraph, vector);
        _this.visibleNodesCount = _this.getVisibleNodesCount(_this.fastGraph);
        _this.visibleEdgesCount = _this.getVisibleEdgesCount(_this.fastGraph);
        _this.refresh(new Date());
    },

    init: function (data)
    {
        // call super-class 'init'
        log("init");
        this.SAGE2Init("canvas", data);
        //arguments.callee.superClass.init.call(this, "canvas", data);

        // application specific 'init'
        this.ctx = this.element.getContext('2d');
        this.ctx.font = "bold 50px Arial";
        this.ctx.textAlign = "left";
        this.ctx.textBaseline = "middle";
        this.maxFPS = 60.0;

        this.openFile("festivaly");
        this.controls.addTextInput({ value: "festivaly", identifier: "OpenFile" });
        this.controls.addSlider({ identifier: "LabelTreshold", minimum: 10, maximum: 100, increments: 1, property: "this.labelSizeTreshold", label: "labels" });
        this.loopBtn = this.controls.addButton({
            identifier: "e--",
            label: "E--",
            type: "zoom-out",
            position: 1
        });

        this.controls.addButton({
            identifier: "e++",
            label: "E++",
            type: "zoom-in",
            position: 2
        });

        this.controls.addButton({
            identifier: "n++",
            label: "N++",
            type: "zoom-in",
            position: 6
        });

        this.controls.addButton({
            identifier: "n--",
            label: "N--",
            type: "zoom-out",
            position: 7
        });

        this.controls.addButton({
            identifier: "colorMode",
            label: "color",
            type: "zoom-out",
            position: 4
        });

        this.controls.addButton({
            identifier: "nodeSize++",
            label: "NS++",
            type: "zoom-out",
            position: 8
        });

        this.controls.addButton({
            identifier: "nodeSize--",
            label: "NS--",
            type: "zoom-out",
            position: 9
        });

        this.controls.addButton({
            identifier: "edgeSize++",
            label: "ES++",
            type: "zoom-out",
            position: 10
        });

        this.controls.addButton({
            identifier: "edgeSize--",
            label: "ES--",
            type: "zoom-out",
            position: 11
        });

        this.controls.finishedAddingControls();
    },

    load: function (state, date)
    {
        log("load");
        this.visibleNodesCount = this.getVisibleNodesCount(this.fastGraph);
        this.visibleEdgesCount = this.getVisibleEdgesCount(this.fastGraph);
        this.refresh(date);
    },

    draw: function (date)
    {
        //log("draw");
        if (!this.graph)
            return;

        this.ctx.clearRect(0, 0, this.element.width, this.element.height);
        this.ctx.save();
        this.ctx.fillStyle = "rgb(255, 255, 255)";
        this.ctx.fillRect(0, 0, this.element.width, this.element.height);
        this.ctx.restore();

        //Edges
        ///////
        for (i = 0; i < this.fastGraph.edges.length; i++)
        {
            var edge = this.fastGraph.edges[i];
            if (!this.isVisibleEdge(edge) || edge.size < this.maximumEdgeSize * this.edgeSizeTreshold / 100.0)
                continue;


            if ((this.selectedNodeId == -1 && this.visibleEdgesCount < 4000) || (this.selectedNodeId != -1 && (edge.source.id == this.selectedNodeId || edge.target.id == this.selectedNodeId))/* || edge.size >= this.maximumEdgeSize * this.edgeSizeTreshold / 100.0*/)
            {
                if (this.colorMode)
                {
                    //each change of color or width is slow in browser, we need to eliminate those unneccessary changes
                    if (this.lastEdgeColor != edge.color)
                    {
                        this.ctx.strokeStyle = edge.color;
                        this.lastEdgeColor = edge.color;
                    }
                }
                else
                {
                    if (this.lastEdgeColor != "rgb(0, 0, 0)")
                    {
                        this.ctx.strokeStyle = "rgb(0, 0, 0)";
                        this.lastEdgeColor = "rgb(0, 0, 0)";
                    }
                }

                if (this.lastEdgeWidth != edge.size / this.maximumEdgeSize * this.edgeRenderSizeMultiplier)
                {
                    this.ctx.lineWidth = edge.size / this.maximumEdgeSize * this.edgeRenderSizeMultiplier;
                    this.lastEdgeWidth = edge.size / this.maximumEdgeSize * this.edgeRenderSizeMultiplier;
                }
            }
            else if (this.selectedNodeId != -1 && this.visibleEdgesCount < 4000) // selection is active
            {
                if (this.lastEdgeColor != "rgba(200, 200, 200, 0.5)")
                {
                    this.ctx.strokeStyle = "rgba(200, 200, 200, 0.5)";
                    this.lastEdgeColor = "rgba(200, 200, 200, 0.5)";
                }
            }
            else continue;

            this.ctx.beginPath();
            this.ctx.moveTo(edge.source.x, edge.source.y);
            this.ctx.lineTo(edge.target.x, edge.target.y);
            this.ctx.stroke();

        }

        //Nodes
        ///////
        for (i = 0; i < this.fastGraph.nodes.length; i++)
        {
            var node = this.fastGraph.nodes[i];
            if (!this.isVisibleNode(node) || node.size < this.maximumNodeSize * this.nodeSizeTreshold / 100.0)
                continue;
            var x = node.x;
            var y = node.y;

            if ((this.selectedNodeId === -1) || node.id === this.selectedNodeId || node.neighbourIsSelected)
            {
                if (this.colorMode)
                {
                    //each change of color or width is slow in browser, we need to eliminate those unneccessary changes
                    if (this.lastNodeColor != node.color)
                    {
                        //log("this.lastNodeColor != node.color");
                        this.ctx.fillStyle = node.color;
                        this.lastNodeColor = node.color;
                    }
                }
                else
                {
                    //each change of color or width is slow in browser, we need to eliminate those unneccessary changes
                    if (this.lastNodeColor != "rgb(255, 0, 0)")
                    {
                        //log("this.lastNodeColor != node.color");
                        this.ctx.fillStyle = "rgb(255, 0, 0)";
                        this.lastNodeColor = "rgb(255, 0, 0)";
                    }
                }
            }
            else
            {
                if (this.lastNodeColor != "rgba(200, 200, 200, 0.5)")
                {
                    this.ctx.fillStyle = "rgba(200, 200, 200, 0.5)";
                    this.lastNodeColor = "rgba(200, 200, 200, 0.5)";
                }
            }

            this.ctx.beginPath();
            this.ctx.arc(x, y, node.size / this.maximumNodeSize * this.nodeRenderSizeMultiplier, 0, 2 * Math.PI);
            this.ctx.fill();

            //if (Math.abs(x - this.mouse.x) < node.size / this.maximumNodeSize * this.nodeRenderSizeMultiplier && Math.abs(y - this.mouse.y) < node.size / this.maximumNodeSize * this.nodeRenderSizeMultiplier)
            //{
            //    // mouse over causes highlight
            //    this.ctx.save();
            //    this.ctx.strokeStyle = "rgb(0, 0, 0)";
            //    this.ctx.lineWidth = 4;
            //    this.ctx.stroke();
            //    this.ctx.restore();
            //}
        }

        //Labels
        ////////
        for (i = 0; i < this.fastGraph.nodes.length; i++)
        {
            var node = this.fastGraph.nodes[i];

            if (!this.isVisibleNode(node))
                continue;

            if ((this.selectedNodeId != -1 && (node.neighbourIsSelected || node.id === this.selectedNodeId)) || (this.selectedNodeId === -1 && this.visibleNodesCount < 100) || node.size >= this.maximumNodeSize * this.labelSizeTreshold / 100.0)
            {
                this.ctx.save();
                this.ctx.font = "bold 50px Arial";
                this.ctx.fillStyle = "rgb(0, 0, 0)";
                this.ctx.fillText(node.label, node.x + node.size * 5, node.y + node.size * 5);
                this.ctx.restore();
            }
        }

        // GUI
        //////
        this.ctx.save();
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        this.ctx.fillRect(5, 5, 350, 210);
        this.ctx.font = "bold 20px Arial";
        this.ctx.fillStyle = "rgb(255, 150, 50)";
        this.ctx.fillText("FPS: " + (1000.0 / (date.getTime() - this.lastDate.getTime())).toFixed(0), 10, 20);
        this.ctx.fillText("Nodes: " + this.fastGraph.nodes.length, 10, 40);
        this.ctx.fillText("Edges: " + this.fastGraph.edges.length, 10, 60);
        this.ctx.fillText("Visible Nodes: " + this.visibleNodesCount, 10, 80);
        this.ctx.fillText("Visible Edges: " + this.visibleEdgesCount, 10, 100);
        this.ctx.fillText("Edge size treshold: " + this.edgeSizeTreshold + " %", 10, 120);
        this.ctx.fillText("Node size treshold: " + this.nodeSizeTreshold + " %", 10, 140);
        this.ctx.fillText("Edge render size multiplier: " + this.edgeRenderSizeMultiplier + " %", 10, 160);
        this.ctx.fillText("Node render size multiplier: " + this.nodeRenderSizeMultiplier + " %", 10, 180);


        if (this.selectedNodeId != -1)
        {
            this.ctx.fillText(this.fastGraph.nodes[this.idMap.get(this.selectedNodeId)].label, 10, 200);
        }

        this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        this.ctx.fillText("v " + this.version, 5, this.ctx.canvas.clientHeight - 15);
        this.ctx.restore();

        this.lastEdgeColor = null;
        this.lastEdgeWidth = null;
        this.lastNodeColor = null;
        this.lastDate = date;
    },

    startResize: function (date)
    {
        this.visibleNodesCount = this.getVisibleNodesCount(this.fastGraph);
        this.visibleEdgesCount = this.getVisibleEdgesCount(this.fastGraph);
        this.refresh(date);
    },

    resize: function (date)
    {
        log("resize");
        this.visibleNodesCount = this.getVisibleNodesCount(this.fastGraph);
        this.visibleEdgesCount = this.getVisibleEdgesCount(this.fastGraph);
        this.refresh(date);
    },

    event: function (eventType, position, user_id, data, date)
    {
        //log("event");
        if (eventType === "pointerScroll")
        {
            if (this.dragMode)
                return;
            var scale = 1.0 + this.zoomStep;
            var translateVector;
            var center = this.findCenter(this.fastGraph);

            if (data.wheelDelta < 0) // zoom in - move graph towards cursor
            {
                translateVector = { x: (position.x * scale - position.x), y: (position.y * scale - position.y) };
            }
            else // zoom out - move graph towards window center
            {
                scale = 1 / scale;
                translateVector = { x: (this.element.width / 2.0 * scale - this.element.width / 2.0), y: (this.element.height / 2.0 * scale - this.element.height / 2.0) };
            }

            this.scaleGraph(this.fastGraph, scale);
            this.translateGraph(this.fastGraph, translateVector);
        }
        else if (eventType == "pointerPress" && data.button === "left")
        {
            this.dragMode = true;
            this.dragUsed = false;
        }
        else if (eventType == "pointerRelease" && data.button === "left")
        {
            this.dragMode = false;

            if (!this.dragUsed)
            {
                this.selectedNodeId = -1;
                this.updateNeighbours(-1);
                this.neighboursOfSelectedNode = [];

                for (i = 0; i < this.selectableNodes.length; i++)
                {
                    if (Math.abs(this.selectableNodes[i].x - position.x) < this.selectableNodes[i].size / this.maximumNodeSize * this.nodeRenderSizeMultiplier && Math.abs(this.selectableNodes[i].y - position.y) < this.selectableNodes[i].size / this.maximumNodeSize * this.nodeRenderSizeMultiplier)
                    {
                        this.selectedNodeId = this.selectableNodes[i].id;
                        this.updateNeighbours(this.selectedNodeId);
                        break;
                    }
                }
            }
        }
        else if (eventType == "pointerMove")
        {
            if (this.dragMode)
            {
                translateVector = { x: this.mouse.x - position.x, y: this.mouse.y - position.y };
                this.translateGraph(this.fastGraph, translateVector);
                this.dragUsed = true;
            }
            this.mouse = position;
        }
        else if (eventType === "widgetEvent")
        {
            if (data.identifier === "Open")
            {
                this.open();
            }
            else if (data.identifier === "OpenFile")
            {
                this.openFile(data.text)
            }
            else if (data.identifier === "e++")
            {
                if (this.edgeSizeTreshold <= 99)
                {
                    this.edgeSizeTreshold += 1;
                }
            }
            else if (data.identifier === "e--")
            {
                if (this.edgeSizeTreshold >= 1)
                {
                    this.edgeSizeTreshold -= 1;
                }
            }
            else if (data.identifier === "n++")
            {
                if (this.nodeSizeTreshold <= 99)
                {
                    this.nodeSizeTreshold += 1;
                }
            }
            else if (data.identifier === "n--")
            {
                if (this.nodeSizeTreshold >= 1)
                {
                    this.nodeSizeTreshold -= 1;
                }
            }
            else if (data.identifier === "colorMode")
            {
                this.colorMode = !this.colorMode;
            }
            else if (data.identifier === "nodeSize--")
            {
                if (this.nodeRenderSizeMultiplier > 4)
                {
                    this.nodeRenderSizeMultiplier -= 4;
                }
            }
            else if (data.identifier === "nodeSize++")
            {
                if (this.nodeRenderSizeMultiplier < 297)
                {
                    this.nodeRenderSizeMultiplier += 4;
                }
            }
            else if (data.identifier === "edgeSize--")
            {
                if (this.edgeRenderSizeMultiplier > 1)
                {
                    this.edgeRenderSizeMultiplier--;
                }
            }
            else if (data.identifier === "edgeSize++")
            {
                if (this.edgeRenderSizeMultiplier < 300)
                {
                    this.edgeRenderSizeMultiplier++;
                }
            }
        }

        this.visibleNodesCount = this.getVisibleNodesCount(this.fastGraph);
        this.visibleEdgesCount = this.getVisibleEdgesCount(this.fastGraph);
        this.refresh(date);
    }
});
