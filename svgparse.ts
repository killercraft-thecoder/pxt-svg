
class SVGParser {
    private svgText: string;
    private img: Image;
    private viewBoxW: number;
    private viewBoxH: number;
    private SmoothCurveAccuracy = 10;
    private TextHeight = 0;

    constructor(svgText: string, SmoothCurveSteps?: number) {
        this.svgText = svgText;
        this.img = image.create(screen.width, screen.height);
        this.viewBoxW = screen.width;
        this.viewBoxH = screen.height;
        this.SmoothCurveAccuracy = SmoothCurveSteps || 10;
        const defs = this.extractDefs();
        this.expandUses(defs);
        this.parseViewBox();
    }

    get smoothCurveSteps() {
        return this.SmoothCurveAccuracy;
    }

    private parseViewBox() {
        let vbPos = this.svgText.indexOf("viewBox=");
        if (vbPos >= 0) {
            let quote1 = this.svgText.indexOf('"', vbPos);
            let quote2 = this.svgText.indexOf('"', quote1 + 1);
            let parts = this.svgText.substr(quote1 + 1, quote2).split(" ");
            if (parts.length == 4) {
                this.viewBoxW = parseFloat(parts[2]);
                this.viewBoxH = parseFloat(parts[3]);
            }
        }
    }

    private scaleX(x: number): number {
        return Math.round(x * screen.width / this.viewBoxW);
    }

    private scaleY(y: number): number {
        return Math.round(y * screen.height / this.viewBoxH);
    }

    render(): Image {
        let pos = 0;
        while (true) {
            let rectPos = this.findTagPos(pos, "rect");
            let circPos = this.findTagPos(pos, "circle");
            let linePos = this.findTagPos(pos, "line");
            let ellipsePos = this.findTagPos(pos, "ellipse");
            let polylinePos = this.findTagPos(pos, "polyline");
            let polygonPos = this.findTagPos(pos, "polygon");
            let pathPos = this.findTagPos(pos, "path");
            let textPos = this.findTagPos(pos, "text");
            let groupPos = this.findTagPos(pos, "g");


            let nextPos = -1;
            let tagType = "";

            // Inline comparisons instead of nested function
            if (rectPos != -1 && (nextPos == -1 || rectPos < nextPos)) { nextPos = rectPos; tagType = "rect"; }
            if (circPos != -1 && (nextPos == -1 || circPos < nextPos)) { nextPos = circPos; tagType = "circle"; }
            if (linePos != -1 && (nextPos == -1 || linePos < nextPos)) { nextPos = linePos; tagType = "line"; }
            if (ellipsePos != -1 && (nextPos == -1 || ellipsePos < nextPos)) { nextPos = ellipsePos; tagType = "ellipse"; }
            if (polylinePos != -1 && (nextPos == -1 || polylinePos < nextPos)) { nextPos = polylinePos; tagType = "polyline"; }
            if (polygonPos != -1 && (nextPos == -1 || polygonPos < nextPos)) { nextPos = polygonPos; tagType = "polygon"; }
            if (pathPos != -1 && (nextPos == -1 || pathPos < nextPos)) { nextPos = pathPos; tagType = "path"; }
            if (textPos != -1 && (nextPos == -1 || textPos < nextPos)) { nextPos = textPos; tagType = "text"; }
            if (groupPos != -1 && (nextPos == -1 || groupPos < nextPos)) { nextPos = groupPos; tagType = "g"; }

            if (nextPos == -1) break;

            if (tagType == "rect") pos = this.parseRect(nextPos);
            else if (tagType == "circle") pos = this.parseCircle(nextPos);
            else if (tagType == "line") pos = this.parseLine(nextPos);
            else if (tagType == "ellipse") pos = this.parseEllipse(nextPos);
            else if (tagType == "polyline") pos = this.parsePolyline(nextPos, false);
            else if (tagType == "polygon") pos = this.parsePolyline(nextPos, true);
            else if (tagType == "path") pos = this.parsePath(nextPos);
            else if (tagType == "text") pos = this.parseText(nextPos);
            else if (tagType == "g") pos = this.parseGroup(nextPos);

        }
        return this.img;
    }

    private extractDefs(): { [id: string]: string } {
        let defs: { [id: string]: string } = {};
        let pos = 0;
        while (true) {
            let defStart = this.svgText.indexOf("<", pos);
            if (defStart == -1) break;
            let defEnd = this.svgText.indexOf(">", defStart);
            if (defEnd == -1) break;

            let tag = this.svgText.substr(defStart, defEnd + 1);
            if (tag.indexOf("<circle") >= 0 || tag.indexOf("<rect") >= 0 || tag.indexOf("<path") >= 0) {
                let id = this.getStringAttr(tag, "id");
                if (id.length > 0) {
                    defs[id] = tag;
                }
            }
            pos = defEnd + 1;
        }
        return defs;
    }

    private expandUses(defs: { [id: string]: string }): void {
        let pos = 0;
        let result = "";
        while (true) {
            let usePos = this.svgText.indexOf("<use", pos);
            if (usePos == -1) {
                result += this.svgText.substr(pos);
                break;
            }

            let tagEnd = this.svgText.indexOf(">", usePos);
            let tag = this.svgText.substr(usePos, tagEnd + 1);
            let href = this.getStringAttr(tag, "href");
            let x = this.getAttr(tag, "x");
            let y = this.getAttr(tag, "y");

            let def = defs[href.substr(1)]; // remove '#' from href
            if (def) {
                // Inject x/y as transform or override attributes
                let injected = def.replace(">", ` x="${x}" y="${y}">`);
                result += this.svgText.substr(pos, usePos) + injected;
            }

            pos = tagEnd + 1;
        }

        this.svgText = result;
    }

    private parseGroup(startPos: number): number {
        let endTag = "</g>";
        let endPos = this.svgText.indexOf(endTag, startPos);
        if (endPos < 0) return this.svgText.length;

        let tagEnd = this.svgText.indexOf(">", startPos);
        if (tagEnd < 0 || tagEnd > endPos) tagEnd = endPos;

        let groupContent = this.svgText.substr(tagEnd + 1, endPos);

        // Create a temporary parser for the group content
        let subParser = new SVGParser(groupContent, this.SmoothCurveAccuracy);
        let subImage = subParser.render();

        // Merge subImage into main image
        this.img.drawImage(subImage, 0, 0);
        subParser = null;
        return endPos + endTag.length;
    }

    // Helper to find tag position with or without namespace prefix
    private findTagPos(fromPos: number, tagName: string): number {
        let plain = this.svgText.indexOf("<" + tagName, fromPos);
        let ns = this.svgText.indexOf(":" + tagName, fromPos);
        if (plain == -1) {
            plain = this.svgText.indexOf("<" + tagName.toUpperCase(), fromPos);
        }
        if (ns == -1) {
            ns = this.svgText.indexOf(":" + tagName.toUpperCase(), fromPos);
        }
        if (plain == -1) return ns;
        if (ns == -1) return plain;
        return plain < ns ? plain : ns;
    }

    private parseEllipse(startPos: number): number {
        let endPos = this.svgText.indexOf(",", startPos);
        let tag = this.svgText.substr(startPos, endPos);

        let cx = this.getAttr(tag, "cx");
        let cy = this.getAttr(tag, "cy");
        let rx = this.getAttr(tag, "rx");
        let ry = this.getAttr(tag, "ry");
        let color = this.colorFromAttr(tag, "fill");

        // Approximate ellipse by drawing horizontal lines
        for (let y = -ry; y <= ry; y++) {
            let w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
            this.img.drawLine(
                this.scaleX(cx - w), this.scaleY(cy + y),
                this.scaleX(cx + w), this.scaleY(cy + y),
                color
            );
        }
        return endPos;
    }

    private parseText(startPos: number): number {
        let endPos = this.svgText.indexOf("</text>", startPos);
        if (endPos < 0) return this.svgText.length;

        let tagEnd = this.svgText.indexOf(">", startPos);
        let tag = this.svgText.substr(startPos, tagEnd + 1);
        let content = this.svgText.substr(tagEnd + 1, (endPos-tagEnd)-1).trim();

        let x = this.scaleX(this.getAttr(tag, "x"));
        let y = this.scaleY(this.getAttr(tag, "y"));
        let rule = false
        if (y == 0 && x == 0) {
            // Asumme that means no Position.
            y = this.TextHeight;
            rule = true;
        }
        let color = this.colorFromAttr(tag, "fill");

        let fontSize = this.getAttr(tag, "font-size");
        let font = image.font8; // default

        if (fontSize > 0) {
            let d5 = Math.abs(fontSize - 5);
            let d8 = Math.abs(fontSize - 8);
            let d12 = Math.abs(fontSize - 12);
            let smallest = Math.min(d5, Math.min(d8, d12));

            if (smallest == d5) {
                font = image.font5;
            } else if (smallest == d8) {
                font = image.font8;
            } else {
                font = image.font12;
            }
        }

        if (rule) {
            this.TextHeight += font.charHeight;
        }
        this.img.print(content, x, y, color, font);
        return endPos + 7;
    }

    private parsePolyline(startPos: number, closed: boolean): number {
        let endPos = this.svgText.indexOf(",", startPos);
        let tag = this.svgText.substr(startPos, endPos);

        let pointsStr = this.getStringAttr(tag, "points");
        let color = this.colorFromAttr(tag, "stroke");

        let coords = pointsStr.trim().split(",");
        for (let i = 0; i < coords.length - 2; i += 2) {
            let x1 = this.scaleX(parseFloat(coords[i]));
            let y1 = this.scaleY(parseFloat(coords[i + 1]));
            let x2 = this.scaleX(parseFloat(coords[i + 2]));
            let y2 = this.scaleY(parseFloat(coords[i + 3]));
            this.img.drawLine(x1, y1, x2, y2, color);
        }

        if (closed && coords.length >= 4) {
            let x1 = this.scaleX(parseFloat(coords[coords.length - 2]));
            let y1 = this.scaleY(parseFloat(coords[coords.length - 1]));
            let x2 = this.scaleX(parseFloat(coords[0]));
            let y2 = this.scaleY(parseFloat(coords[1]));
            this.img.drawLine(x1, y1, x2, y2, color);
        }

        return endPos;
    }

    private parsePath(startPos: number): number {
        // Find the end of the tag
        let endPos = this.svgText.indexOf(">", startPos);
        if (endPos < 0) endPos = this.svgText.length;
        let tag = this.svgText.substr(startPos, endPos);

        // Get path data and stroke color
        let d = this.getStringAttr(tag, "d");
        let color = this.colorFromAttr(tag, "stroke");

        // Tokenize: replace commas with spaces, then split on spaces
        d = d.replace(",", " ");
        while (d.indexOf(",") >= 0) d = d.replace(",", " ");
        let rawTokens = d.trim().split(" ");
        let tokens: string[] = [];
        for (let t of rawTokens) {
            let tt = t.trim();
            if (tt.length > 0) tokens.push(tt);
        }

        let prevX = 0;
        let prevY = 0;
        let prevCX = 0;
        let prevCY = 0;
        let startX = 0;
        let startY = 0;
        let i = 0;
        let prevCmd = "";
        while (i < tokens.length) {
            let cmd = tokens[i++];
            let isRelative = (cmd >= "a" && cmd <= "z");
            cmd = cmd.toUpperCase();

            if (cmd == "M" || cmd == "L") {
                let x = parseFloat(tokens[i++]);
                let y = parseFloat(tokens[i++]);
                if (isRelative) { x += prevX; y += prevY; }
                x = this.scaleX(x);
                y = this.scaleY(y);
                if (cmd == "L") {
                    this.img.drawLine(prevX, prevY, x, y, color);
                }
                prevX = x;
                prevY = y;
                if (cmd == "M") { startX = x; startY = y; }
            }
            else if (cmd == "H") {
                let x = parseFloat(tokens[i++]);
                if (isRelative) x += prevX;
                x = this.scaleX(x);
                this.img.drawLine(prevX, prevY, x, prevY, color);
                prevX = x;
            }
            else if (cmd == "V") {
                let y = parseFloat(tokens[i++]);
                if (isRelative) y += prevY;
                y = this.scaleY(y);
                this.img.drawLine(prevX, prevY, prevX, y, color);
                prevY = y;
            }
            else if (cmd == "Z") {
                // Close path
                this.img.drawLine(prevX, prevY, startX, startY, color);
                prevX = startX;
                prevY = startY;
            }
            else if (cmd == "C") {
                let x1 = this.scaleX(parseFloat(tokens[i++]));
                let y1 = this.scaleY(parseFloat(tokens[i++]));
                let x2 = this.scaleX(parseFloat(tokens[i++]));
                let y2 = this.scaleY(parseFloat(tokens[i++]));
                let x = this.scaleX(parseFloat(tokens[i++]));
                let y = this.scaleY(parseFloat(tokens[i++]));

                this.drawCubicBezier(prevX, prevY, x1, y1, x2, y2, x, y, color);
                prevX = x;
                prevY = y;
                prevCX = x2;
                prevCY = y2;
            }
            else if (cmd == "Q") {
                let x1 = this.scaleX(parseFloat(tokens[i++]));
                let y1 = this.scaleY(parseFloat(tokens[i++]));
                let x = this.scaleX(parseFloat(tokens[i++]));
                let y = this.scaleY(parseFloat(tokens[i++]));

                this.drawQuadraticBezier(prevX, prevY, x1, y1, x, y, color);
                prevX = x;
                prevY = y;
            }
            else if (cmd == "A") {
                let rx = parseFloat(tokens[i++]);
                let ry = parseFloat(tokens[i++]);
                let rotation = parseFloat(tokens[i++]); // ignored
                let largeArc = parseInt(tokens[i++]);   // ignored
                let sweep = parseInt(tokens[i++]);      // ignored
                let x = this.scaleX(parseFloat(tokens[i++]));
                let y = this.scaleY(parseFloat(tokens[i++]));

                // Approximate arc as circular
                let r = Math.min(rx, ry) * (160 / this.viewBoxW); // scale radius
                this.drawArc(prevX, prevY, x, y, Math.round(r), color);
                prevX = x;
                prevY = y;
            }
            else if (cmd == "S") {
                // Determine first control point (x1, y1)
                let x1: number;
                let y1: number;
                if (prevCmd == "C" || prevCmd == "S") {
                    // Reflect previous control point across current point
                    x1 = 2 * prevX - prevCX;
                    y1 = 2 * prevY - prevCY;
                } else {
                    // No reflection — use current point
                    x1 = prevX;
                    y1 = prevY;
                }

                // Second control point and end point from tokens
                let x2 = this.scaleX(parseFloat(tokens[i++]));
                let y2 = this.scaleY(parseFloat(tokens[i++]));
                let x = this.scaleX(parseFloat(tokens[i++]));
                let y = this.scaleY(parseFloat(tokens[i++]));

                // Draw smooth cubic Bezier
                this.drawCubicBezier(prevX, prevY, x1, y1, x2, y2, x, y, color);

                // Store control point for potential smooth chaining
                prevCX = x2;
                prevCY = y2;

                // Update current position and command
                prevX = x;
                prevY = y;
                prevCmd = "S";
            }
            else {
                console.log("[PXT-SVG] Unsupported Path Command:" + cmd);
                // Unsupported command — skip numbers until next letter
                while (i < tokens.length && !(tokens[i].length == 1 && tokens[i].toUpperCase() >= "A" && tokens[i].toUpperCase() <= "Z")) {
                    i++;
                }
            }
            prevCmd = cmd;
        }

        return endPos;
    }

    

    private drawQuadraticBezier(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, color: number) {
        let steps = this.SmoothCurveAccuracy;
        let prevX = x0;
        let prevY = y0;
        for (let t = 0; t <= steps; t++) {
            let u = t / steps;
            let x = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * x1 + u * u * x2;
            let y = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * y1 + u * u * y2;
            this.img.drawLine(prevX, prevY, Math.round(x), Math.round(y), color);
            prevX = Math.round(x);
            prevY = Math.round(y);
        }
    }

    private drawArc(x0: number, y0: number, x1: number, y1: number, r: number, color: number) {
        let steps = this.SmoothCurveAccuracy;
        let cx = (x0 + x1) / 2;
        let cy = (y0 + y1) / 2;
        let angleStart = Math.atan2(y0 - cy, x0 - cx);
        let angleEnd = Math.atan2(y1 - cy, x1 - cx);

        // Ensure angleEnd > angleStart
        if (angleEnd < angleStart) angleEnd += 2 * Math.PI;

        let prevX = x0;
        let prevY = y0;
        for (let t = 1; t <= steps; t++) {
            let angle = angleStart + (angleEnd - angleStart) * (t / steps);
            let x = cx + r * Math.cos(angle);
            let y = cy + r * Math.sin(angle);
            this.img.drawLine(prevX, prevY, Math.round(x), Math.round(y), color);
            prevX = Math.round(x);
            prevY = Math.round(y);
        }
    }

    private drawCubicBezier(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, color: number) {
        let steps = this.SmoothCurveAccuracy;
        let prevX = x0;
        let prevY = y0;
        for (let t = 0; t <= steps; t++) {
            let u = t / steps;
            let x = Math.pow(1 - u, 3) * x0 +
                3 * Math.pow(1 - u, 2) * u * x1 +
                3 * (1 - u) * u * u * x2 +
                u * u * u * x3;
            let y = Math.pow(1 - u, 3) * y0 +
                3 * Math.pow(1 - u, 2) * u * y1 +
                3 * (1 - u) * u * u * y2 +
                u * u * u * y3;
            this.img.drawLine(prevX, prevY, Math.round(x), Math.round(y), color);
            prevX = Math.round(x);
            prevY = Math.round(y);
        }
    }

    private parseRect(startPos: number): number {
        let endPos = this.svgText.indexOf(",", startPos);
        let tag = this.svgText.substr(startPos, endPos);

        let x = this.getAttr(tag, "x");
        let y = this.getAttr(tag, "y");
        let w = this.getAttr(tag, "width");
        let h = this.getAttr(tag, "height");
        let color = this.colorFromAttr(tag, "fill");

        this.img.fillRect(this.scaleX(x), this.scaleY(y), this.scaleX(w), this.scaleY(h), color);
        return endPos;
    }

    private parseCircle(startPos: number): number {
        let endPos = this.svgText.indexOf(">", startPos);
        let tag = this.svgText.substr(startPos, endPos);

        let cx = this.getAttr(tag, "cx");
        let cy = this.getAttr(tag, "cy");
        let r = this.getAttr(tag, "r")
        let color = this.colorFromAttr(tag, "fill");
        this.img.fillCircle(this.scaleX(cx), this.scaleY(cy), Math.round(r * (160 / this.viewBoxW)), color);
        return endPos;
    }

    private parseLine(startPos: number): number {
        let endPos = this.svgText.indexOf(">", startPos);
        let tag = this.svgText.substr(startPos, endPos);

        let x1 = this.getAttr(tag, "x1");
        let y1 = this.getAttr(tag, "y1");
        let x2 = this.getAttr(tag, "x2");
        let y2 = this.getAttr(tag, "y2");

        let color = this.colorFromAttr(tag, "stroke");
        this.img.drawLine(this.scaleX(x1), this.scaleY(y1), this.scaleX(x2), this.scaleY(y2), color);

        return endPos;
    }
    // New: map an SVG hex color to your chosen palette
    private colorFromAttr(tag: string, attrName: string): number {
        let hex = this.getStringAttr(tag, attrName);
        if (hex.length == 0) return 1; // default white if missing
        if (hex.charAt(0) == '#') hex = hex.substr(1);

        let r = parseInt(hex.substr(0, 2), 16);
        let g = parseInt(hex.substr(2, 2), 16);
        let b = parseInt(hex.substr(4, 2), 16);

        // RGB values for closest-match calculation
        const palette: number[][] = [
            [255, 255, 255], // 1 white (#FFFFFF)
            [255, 33, 33],   // 2 red (#FF2121)
            [255, 147, 196], // 3 pink (#FF93C4)
            [255, 129, 53],  // 4 orange (#FF8135)
            [255, 246, 9],   // 5 yellow (#FFF609)
            [36, 156, 170],  // 6 cyan-ish (#249CAA)
            [120, 220, 82],  // 7 green (#78DC52)
            [0, 63, 173],    // 8 dark blue (#003FAD)
            [135, 242, 255], // 9 light blue (#87F2FF)
            [142, 46, 196],  // 10 purple (#8E2EC4)
            [164, 131, 159], // 11 mauve (#A4839F)
            [92, 64, 156],   // 12 indigo (#5C409C)
            [229, 205, 196], // 13 pale brown (#E5CDC4)
            [145, 70, 61],   // 14 deep brown (#91463D)
            [0, 0, 0]        // 15 black (#000000)
        ];

        // Matching palette indexes in MakeCode Arcade
        const paletteIndex: number[] = [
            1,  // white
            2,  // red
            3,  // pink
            4,  // orange
            5,  // yellow
            6,  // cyan-ish
            7,  // green
            8,  // dark blue
            9,  // light blue
            10, // purple
            11, // mauve
            12, // indigo
            13, // pale brown
            14, // deep brown
            15  // black
        ];

        let bestIndex = 1;
        let bestDist = 999999;
        for (let i = 0; i < palette.length; i++) {
            let dr = palette[i][0] - r;
            let dg = palette[i][1] - g;
            let db = palette[i][2] - b;
            let dist = dr * dr + dg * dg + db * db;
            if (dist < bestDist) {
                bestDist = dist;
                bestIndex = paletteIndex[i];
            }
        }
        return bestIndex;
    }

    // Slightly refactored getAttr to get numbers
    private getAttr(tag: string, name: string): number {
        let valStr = this.getStringAttr(tag, name);
        if (valStr.length > 0) return parseFloat(valStr);
        return 0;

    }

    // New: get string attribute (for colors)
    private getStringAttr(tag: string, name: string): string {
        let pos = tag.indexOf(name + "=");
        if (pos >= 0) {
            let quote1 = tag.indexOf('"', pos);
            let quote2 = tag.indexOf('"', quote1 + 1);
            return tag.substr(quote1 + 1, quote2).trim();
        }
        return "";
    }

}