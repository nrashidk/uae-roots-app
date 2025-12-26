// Store the factory result for ES6 export
var FamilyTreeLayoutModule;

(function (root, factory) {
    FamilyTreeLayoutModule = factory(); // Store for ES6 export

    if (typeof define === "function" && define.amd) {
        // AMD (RequireJS)
        define([], factory);
    } else if (typeof module === "object" && module.exports) {
        // CommonJS (Node.js)
        module.exports = FamilyTreeLayoutModule;
    } else {
        // Browser global
        root.FamilyTreeLayout = FamilyTreeLayoutModule;
    }
})(typeof self !== "undefined" ? self : this, function () {
    "use strict";

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================

    /**
     * Parse date string into components
     * @param {string|number} d - Date string in format YYYYMMDD or BYYYYMMDD for BCE
     * @returns {Object} Object with d (day), m (month), y (year) properties
     */
    function parseDate(d) {
        if (typeof d === "string" || d instanceof String) {
            let bce = d.substring(0, 1) === "B";
            if (bce) {
                d = d.substring(1);
            }
            let yr = parseInt(d.substring(0, 4), 10);
            if (bce) {
                yr = -yr;
            }
            return {
                d: parseInt(d.substring(6, 8), 10),
                m: parseInt(d.substring(4, 6), 10),
                y: yr,
            };
        }
        return {};
    }

    /**
     * Compare two dates
     * @param {Object} d1 - First date object
     * @param {Object} d2 - Second date object
     * @returns {number} Negative if d1 < d2, positive if d1 > d2, 0 if equal
     */
    function compareDate(d1, d2) {
        if (d1.y !== d2.y) return d1.y - d2.y;
        if (d1.m !== d2.m) return d1.m - d2.m;
        return d1.d - d2.d;
    }

    /**
     * Check if date has meaningful data
     * @param {string|number} d - Date string
     * @returns {boolean} True if date has month or year
     */
    function hasActualDate(d) {
        const p = parseDate(d);
        return !!(p.m || p.y);
    }

    /**
     * Get person order value (for sorting)
     * @param {Object} p - Person object
     * @param {boolean} o - Use order field if true
     * @returns {number|null} Order value
     */
    function getPersonOrder(p, o) {
        const d = parseDate(p.b);
        if (!o && d.y) {
            return d.y * 10000 + d.m * 100 + d.d;
        }
        if (p.O && !isNaN(parseFloat(p.O))) {
            return parseFloat(p.O);
        }
        return null;
    }

    /**
     * Compare two people (for sorting)
     * @param {Object} p1 - First person
     * @param {Object} p2 - Second person
     * @returns {number} Comparison result
     */
    function comparePeople(p1, p2) {
        let b1 = getPersonOrder(p1);
        let b2 = getPersonOrder(p2);

        if (b1 === b2) {
            b1 = getPersonOrder(p1, true);
            b2 = getPersonOrder(p2, true);
        }

        if (b1 === null) b1 = 99999999;
        if (b2 === null) b2 = 99999999;

        if (b1 < b2) return -1;
        if (b2 < b1) return 1;

        if (p1.ai < p2.ai) return -1;
        if (p1.ai > p2.ai) return 1;

        return 0;
    }

    /**
     * Get gender multiplier for sorting
     * @param {string} g - Gender ('f', 'm', or other)
     * @returns {number} -1 for female, 1 for male, 0 for other
     */
    function getGenderMultiplier(g) {
        return g === "f" ? -1 : g === "m" ? 1 : 0;
    }

    /**
     * Compare genders
     * @param {Object} p1 - First person
     * @param {Object} p2 - Second person
     * @returns {number} Comparison result
     */
    function compareGender(p1, p2) {
        return (
            (p1 ? getGenderMultiplier(p1.g) : 0) -
            (p2 ? getGenderMultiplier(p2.g) : 0)
        );
    }

    /**
     * Get parent multiplier (for determining side placement)
     * @param {Object} f - Family data
     * @param {string} i - Person ID
     * @returns {number} Multiplier value
     */
    function getParentMultiplier(f, i) {
        let m = 0;
        if (i && f[i]) {
            const ca = f[i].c;
            for (let j = 0; j < ca.length; j++) {
                const c = f[ca[j]];
                if (c.m === i) m--;
                if (c.f === i) m++;
                if (c.X === i) m--;
                if (c.Y === i) m++;
                if (c.K === i) m--;
                if (c.L === i) m++;
            }
        }
        return m;
    }

    /**
     * Determine which side a spouse should be on
     * @param {Object} f - Family data
     * @param {string} i - Person ID
     * @param {string} si - Spouse ID
     * @returns {boolean} True for right side
     */
    function getSpouseSide(f, i, si) {
        let cm = getParentMultiplier(f, i) - getParentMultiplier(f, si);
        if (!cm) {
            cm = compareGender(i ? f[i] : null, si ? f[si] : null);
        }
        return cm ? cm < 0 : si ? i < si : false;
    }

    /**
     * Check if relationship is non-biological
     * @param {Object} p - Person object
     * @param {string} pi - Parent ID
     * @returns {boolean} True if non-biological
     */
    function isNonBiological(p, pi) {
        const nonBioTypes = ["a", "f", "s", "g"];

        if (pi === p.m1 || pi === p.f1) {
            if (p.t1) return nonBioTypes.includes(p.t1);
            return p.t2 === "b" || p.t3 === "b";
        }

        if (pi === p.m2 || pi === p.f2) {
            if (p.t2) return nonBioTypes.includes(p.t2);
            return p.t1 === "b" || p.t3 === "b";
        }

        if (pi === p.m3 || pi === p.f3) {
            if (p.t3) return nonBioTypes.includes(p.t3);
            return p.t1 === "b" || p.t2 === "b";
        }

        return false;
    }

    /**
     * Check if parent set is non-biological
     * @param {Object} p - Person object
     * @param {number} s - Parent set number (1, 2, or 3)
     * @returns {boolean} True if non-biological
     */
    function isParentSetNonBio(p, s) {
        return isNonBiological(p, p[`m${s}`] || p[`f${s}`]);
    }

    /**
     * Check if partnership is current/married
     * @param {Object} f - Family data
     * @param {string} mi - First partner ID
     * @param {string} fi - Second partner ID
     * @returns {boolean} True if current partnership
     */
    function isCurrentPartnership(f, mi, fi) {
        return f[mi] && f[fi] && f[mi].s === fi && f[fi].s === mi;
    }

    /**
     * Check if partnership is current or engaged
     * @param {Object} f - Family data
     * @param {string} mi - First partner ID
     * @param {string} fi - Second partner ID
     * @returns {boolean} True if current or engaged
     */
    function isUnionPartnership(f, mi, fi) {
        return isCurrentPartnership(f, mi, fi) || f[mi]?.ep?.[fi] === 2;
    }

    // ============================================================================
    // ARRAY UTILITY FUNCTIONS
    // ============================================================================

    /**
     * Add unique items from one array to another
     * @param {Array} a - Target array
     * @param {Array} a2 - Source array
     */
    function addUniqueToArray(a, a2) {
        for (let j = 0; j < a2.length; j++) {
            if (!a.includes(a2[j])) {
                a.push(a2[j]);
            }
        }
    }

    /**
     * Remove items from array
     * @param {Array} a - Target array
     * @param {Array} ar - Items to remove
     */
    function removeFromArray(a, ar) {
        for (let j = 0; j < ar.length; j++) {
            const index = a.indexOf(ar[j]);
            if (index >= 0) {
                a.splice(index, 1);
            }
        }
    }

    // ============================================================================
    // FAMILY DATA FUNCTIONS
    // ============================================================================

    /**
     * Get partner field name
     * @param {Object} p - Person object
     * @param {string} i - Partner ID
     * @returns {string|null} Field name (e.g., 'f1', 'm2')
     */
    function getPartnerField(p, i) {
        if (i === p.m1) return "f1";
        if (i === p.f1) return "m1";
        if (i === p.m2) return "f2";
        if (i === p.f2) return "m2";
        if (i === p.m3) return "f3";
        if (i === p.f3) return "m3";
        return null;
    }

    /**
     * Sort children by birth date
     * @param {Object} f - Family data
     * @param {Array} ci - Array of child IDs
     */
    function sortChildren(f, ci) {
        const cp = [];
        for (let j = 0; j < ci.length; j++) {
            cp.push(f[ci[j]]);
        }
        cp.sort(comparePeople);
        ci.length = 0;
        for (let j = 0; j < cp.length; j++) {
            ci.push(cp[j].i);
        }
    }

    /**
     * Get children with only one parent
     * @param {Object} f - Family data
     * @param {string} i - Parent ID
     * @returns {Array} Array of child IDs
     */
    function getAloneChildren(f, i) {
        const ac = [];
        const c = f[i].c;

        for (let j = 0; j < c.length; j++) {
            const cp = f[c[j]];
            const pf = getPartnerField(cp, i);
            const oi = pf ? cp[pf] : null;
            if (!(oi && f[oi])) {
                ac.push(c[j]);
            }
        }

        sortChildren(f, ac);
        return ac;
    }

    /**
     * Get children with specific partner
     * @param {Object} f - Family data
     * @param {string} i - Parent ID
     * @param {string} pi - Partner ID
     * @returns {Array} Array of child IDs
     */
    function getPartnerChildren(f, i, pi) {
        const tc = [];
        const c = f[i].c;

        for (let j = 0; j < c.length; j++) {
            const cp = f[c[j]];
            const pf = getPartnerField(cp, i);
            if (pf && cp[pf] === pi) {
                tc.push(c[j]);
            }
        }

        sortChildren(f, tc);
        return tc;
    }

    /**
     * Get siblings
     * @param {Object} f - Family data
     * @param {string} i - Person ID
     * @param {number} s - Parent set (1, 2, or 3)
     * @returns {Array} Array of sibling IDs
     */
    function getSiblings(f, i, s) {
        const bs = [];
        const mi = f[i][`m${s}`];
        const fi = f[i][`f${s}`];
        const cs = {};

        if (mi && f[mi]) {
            const c = f[mi].c;
            for (let j = 0; j < c.length; j++) {
                cs[c[j]] = true;
            }
        }

        if (fi && f[fi]) {
            const c = f[fi].c;
            for (let j = 0; j < c.length; j++) {
                cs[c[j]] = true;
            }
        }

        for (const j in cs) {
            if (j !== i && hasMatchingParents(f[j], mi, fi)) {
                bs.push(j);
            }
        }

        sortChildren(f, bs);
        return bs;
    }

    /**
     * Check if person has matching parents
     * @param {Object} p - Person object
     * @param {string} mi - Mother ID
     * @param {string} fi - Father ID
     * @returns {boolean} True if parents match
     */
    function hasMatchingParents(p, mi, fi) {
        return (
            (p.m1 === mi && p.f1 === fi) ||
            (p.m1 === fi && p.f1 === mi) ||
            (p.m2 === mi && p.f2 === fi) ||
            (p.m2 === fi && p.f2 === mi) ||
            (p.m3 === mi && p.f3 === fi) ||
            (p.m3 === fi && p.f3 === mi)
        );
    }

    /**
     * Get sorted spouses
     * @param {Object} p - Person object
     * @param {string} si - Exclude this spouse ID
     * @param {boolean} s - Include si in result
     * @returns {Object} Object with spouse IDs as keys
     */
    function getSortedSpouses(p, si, s) {
        const ps = [];
        for (const pi in p.pc) {
            if (pi !== si) {
                const gpi = String(p.gp?.[pi] || "");
                let d = 99999999;

                if (["m", "s", "d", "a"].includes(gpi)) {
                    if (p.mp?.[pi]) {
                        d = p.mp[pi];
                    }
                } else if (gpi === "e") {
                    if (p.rp?.[pi]) {
                        d = p.rp[pi];
                    }
                } else if (gpi.charAt(0) === "o" || gpi === "r") {
                    if (p.bp?.[pi]) {
                        d = p.bp[pi];
                    }
                }

                const ds = parseDate(String(d));
                ds.i = pi;
                ps.push(ds);
            }
        }

        ps.sort(compareDate);
        const po = {};

        // Include si in result if s is true
        if (s && si) {
            po[si] = true;
        }

        for (let j = 0; j < ps.length; j++) {
            po[ps[j].i] = true;
        }

        return po;
    }

    // ============================================================================
    // TREE DATA STRUCTURE FUNCTIONS
    // ============================================================================

    /**
     * Create new tree data structure
     * @returns {Object} Tree data object
     */
    function createTreeData() {
        return {
            l: 0, // left boundary
            r: 0, // right boundary
            w: 0, // width
            t: 0, // top boundary
            b: 0, // bottom boundary
            h: 0, // height
            e: {}, // entities (person boxes)
            n: [], // lines
            p: [], // partner labels
            yl: {}, // left boundary per y level
            yr: {}, // right boundary per y level
            u: 0, // unique counter
        };
    }

    /**
     * Add entity (person box) to tree
     * @param {Object} d - Tree data
     * @param {string} i - Person ID
     * @param {Object} p - Person object
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {boolean} k - Is key person
     */
    function addEntity(d, i, p, x, y, k) {
        const e = { p, x, y, k };

        if (d.e[i]) {
            e.d = i;
            if (!d.e[i].d) {
                d.e[i].d = i;
                d.e[i].u = ++d.u;
            }
            d.e[i + Math.random()] = e;
        } else {
            d.e[i] = e;
        }

        d.l = Math.min(d.l, x);
        d.r = Math.max(d.r, 1 + x);
        d.w = d.r - d.l;
        d.t = Math.min(d.t, y);
        d.b = Math.max(d.b, 1 + y);
        d.h = d.b - d.t;

        if (d.yl[y] === undefined) {
            d.yl[y] = x;
        } else {
            d.yl[y] = Math.min(d.yl[y], x);
        }

        if (d.yr[y] === undefined) {
            d.yr[y] = 1 + x;
        } else {
            d.yr[y] = Math.max(d.yr[y], 1 + x);
        }
    }

    /**
     * Add line to tree
     * @param {Object} d - Tree data
     * @param {number} x1 - Start X
     * @param {number} y1 - Start Y
     * @param {number} x2 - End X
     * @param {number} y2 - End Y
     * @param {string} t - Line type
     * @param {string} c - Line class
     */
    function addLine(d, x1, y1, x2, y2, t, c) {
        const l = { x1, y1, x2, y2, t };
        if (c) {
            l.c = c;
        }
        d.n.push(l);
    }

    /**
     * Add partner label
     * @param {Object} d - Tree data
     * @param {string} i - Person ID
     * @param {string} si - Spouse ID
     * @param {number} x1 - Start X
     * @param {number} x2 - End X
     * @param {number} y - Y coordinate
     * @param {boolean} b - Is below
     */
    function addPartnerLabel(d, i, si, x1, x2, y, b) {
        if (Math.abs(x1 - x2) > 1.1) {
            d.p.push({ i, si, x1, x2, y, b });
        }
    }

    /**
     * Merge tree data
     * @param {Object} od - Target tree data
     * @param {Object} d - Source tree data
     * @param {number} dx - X offset
     * @param {number} dy - Y offset
     */
    function mergeTreeData(od, d, dx, dy) {
        for (let j = 0; j < d.n.length; j++) {
            const n = d.n[j];
            addLine(od, n.x1 + dx, n.y1 + dy, n.x2 + dx, n.y2 + dy, n.t, n.c);
        }

        for (let j = 0; j < d.p.length; j++) {
            const p = d.p[j];
            addPartnerLabel(od, p.i, p.si, p.x1 + dx, p.x2 + dx, p.y + dy, p.b);
        }

        for (const i in d.e) {
            const e = d.e[i];
            addEntity(od, e.p.i, e.p, e.x + dx, e.y + dy, e.k);
        }
    }

    // ============================================================================
    // CORE LAYOUT ALGORITHM
    // ============================================================================

    // Constants
    const Btc = { pd: 4 }; // Parent distance threshold

    /**
     * Calculate marriage gap (spacing between spouses)
     * @param {Object} f - Family data
     * @param {string} i - Person ID
     * @param {string} si - Spouse ID
     * @param {Object} pg - Display options
     * @returns {number} Gap size
     */
    function calculateMarriageGap(f, i, si, pg) {
        let eg = 0;
        const p = f[i];
        if (pg["m"] && si) {
            if (p.gp && p.mp) {
                const t = p.gp[si];
                if (
                    (t === "m" || t === "s" || t === "d" || t === "a") &&
                    hasActualDate(p.mp[si])
                ) {
                    eg = Math.max(eg, 0.625);
                }
            }
        }
        if (pg["w"] && si) {
            if (p.gp && p.wp) {
                const t = p.gp[si];
                if (
                    (t === "m" || t === "s" || t === "d" || t === "a") &&
                    p.wp[si]
                ) {
                    eg = Math.max(eg, 1.125);
                }
            }
        }
        if (pg["d"] && si) {
            if (p.gp && p.dp) {
                if (p.gp[si] === "d" && hasActualDate(p.dp[si])) {
                    eg = Math.max(eg, 0.625);
                }
            }
        }
        return 1 + eg;
    }

    /**
     * Add alone children stub (vertical line for children without partner)
     * @param {Object} d - Tree data
     * @param {Object} f - Family data
     * @param {string} i - Person ID
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    function addAloneChildrenStub(d, f, i, x, y) {
        const ac = getAloneChildren(f, i);
        if (ac.length) {
            let sb = false;
            let sg = false;
            for (let j = 0; j < ac.length; j++) {
                if (isNonBiological(f[ac[j]], i)) {
                    sg = true;
                } else {
                    sb = true;
                }
            }
            if (sb) {
                addLine(d, x, y, x, y + 0.35, "b");
            }
            if (sg) {
                addLine(d, x, y, x, y + 0.35, "c");
            }
        }
    }

    /**
     * Draw children lines (vertical and horizontal connectors)
     * @param {Object} d - Tree data
     * @param {number} vx - Vertical line X position
     * @param {Array} ax - Array of child X positions
     * @param {number} vy - Vertical line Y start
     * @param {number} cy - Children Y position
     * @param {Array} gs - Array of relationship types (biological/non-biological)
     * @param {number} yo - Y offset
     */
    function drawChildrenLines(d, vx, ax, vy, cy, gs, yo) {
        let sb = false;
        let sg = false;
        let minB = vx,
            maxB = vx;
        let minG = vx,
            maxG = vx;
        const ay = (vy + cy) / 2 + yo;
        for (let j = 0; j < gs.length; j++) {
            const x = ax[j];
            if (gs[j]) {
                sg = true;
                minG = Math.min(minG, x);
                maxG = Math.max(maxG, x);
            } else {
                sb = true;
                minB = Math.min(minB, x);
                maxB = Math.max(maxB, x);
            }
            addLine(d, x, ay, x, cy, gs[j] ? "C" : "B");
        }
        const minAll = Math.min(minB, minG);
        const maxAll = Math.max(maxB, maxG);
        for (let g = 0; g <= 1; g++) {
            if (g ? sg : sb) {
                const s = g ? "C" : "B";
                if (vx < minAll || vx > maxAll) {
                    const x = vx < minAll ? minAll : maxAll;
                    const y = (vy + ay) / 2;
                    addLine(d, vx, vy, vx, y, s);
                    addLine(d, vx, y, x, y, s);
                    addLine(d, x, y, x, ay, s);
                } else {
                    addLine(d, vx, vy, vx, ay, s);
                }
                addLine(d, g ? minG : minB, ay, g ? maxG : maxB, ay, s);
            }
        }
    }

    /**
     * Add person box with parent lines
     * @param {Object} d - Tree data
     * @param {Object} f - Family data
     * @param {string} i - Person ID
     * @param {string} si - Spouse ID (optional)
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {boolean} pd - Show parent lines
     * @param {boolean|null} sr - Spouse side (true=right, false=left, null=none)
     * @param {boolean} da - Draw alone children stub
     */
    function addPersonBox(d, f, i, si, x, y, pd, sr, da) {
        const p = f[i];
        addEntity(d, i, p, x, y);
        if (pd) {
            if (p.m1 || p.f1) {
                addLine(
                    d,
                    x,
                    y,
                    x,
                    y - 0.425,
                    isParentSetNonBio(p, 1) ? "c" : "b",
                );
            }
            if (p.m2 || p.f2) {
                addLine(
                    d,
                    x + 0.05,
                    y,
                    x + 0.05,
                    y - 0.45,
                    isParentSetNonBio(p, 2) ? "c" : "b",
                );
            }
        }
        if (sr !== null && p.cp > (si && p.pc[si] ? 1 : 0)) {
            addLine(
                d,
                x,
                y,
                x + (sr ? 0.475 : -0.475),
                y,
                p.s && f[p.s] && p.s !== si ? "s" : "p",
            );
        }
        if (da) {
            addAloneChildrenStub(d, f, i, x, y);
        }
    }

    /**
     * Draw additional spouses/partners
     * @param {Object} d - Tree data
     * @param {Object} f - Family data
     * @param {string} i - Person ID
     * @param {string} si - Excluded spouse ID
     * @param {number} h - Depth
     * @param {boolean} dr - Direction
     * @param {number} fx - X position
     * @param {number} cy - Current Y
     * @param {boolean} fl - Flip layout
     * @param {Object} pg - Display options
     * @param {Object} dp - Duplicate tracking
     * @param {Array} excludeChildren - Children IDs to exclude from partner children
     * @param {Object} pcx - Partner X positions
     * @param {string} excludeParent - Parent ID to exclude from m2/f2/m3/f3 line drawing
     */
    function drawAdditionalSpouses(
        d,
        f,
        i,
        si,
        h,
        dr,
        fx,
        cy,
        fl,
        pg,
        dp,
        excludeChildren,
        pcx,
        excludeParent,
    ) {
        const p = f[i];
        const ps = getSortedSpouses(p, si, false);
        let yt = 0;
        for (const pi in ps) {
            yt++;
        }
        const ot = Math.min(0.1 * (yt - 1), 0.15);
        let ly = cy + ot / 2;
        const lo = yt > 1 ? ot / (yt - 1) : 0;
        const uo = 0.1 / (yt + 1);
        let uy = cy - 0.5 + uo * (yt + 1);
        const ax = [];
        for (const pi in ps) {
            if (dp.p[i + "-" + pi]) {
                addLine(
                    d,
                    fx,
                    ly,
                    fx + (dr ? 0.475 : -0.475),
                    ly,
                    isCurrentPartnership(f, i, pi) ? "s" : "p",
                );
            } else {
                dp.p[i + "-" + pi] = true;
                dp.p[pi + "-" + i] = true;
                let pc = getPartnerChildren(f, i, pi);
                // Remove excluded children from partner children list
                if (excludeChildren && excludeChildren.length) {
                    pc = pc.filter(
                        (childId) => !excludeChildren.includes(childId),
                    );
                }
                drawPartnerWithChildren(
                    d,
                    f,
                    i,
                    pi,
                    pc,
                    h,
                    dr,
                    fx,
                    cy,
                    ly,
                    uy,
                    fl,
                    pg,
                    dp,
                    ax,
                    pcx,
                    excludeParent,
                );
            }
            ly -= lo;
            uy -= uo;
        }
    }

    /**
     * Draw partner with children
     * @param {Object} d - Tree data
     * @param {Object} f - Family data
     * @param {string} i - Person ID
     * @param {string} pi - Partner ID
     * @param {Array} ci - Children IDs
     * @param {number} h - Depth
     * @param {boolean} dr - Direction
     * @param {number} fx - X position
     * @param {number} cy - Current Y
     * @param {number} ly - Line Y
     * @param {number} uy - Upper Y
     * @param {boolean} fl - Flip layout
     * @param {Object} pg - Display options
     * @param {Object} dp - Duplicate tracking
     * @param {Array} ax - X positions array
     * @param {Object} pcx - Partner X positions
     * @param {string} excludeParent - Parent ID to exclude from m2/f2/m3/f3 line drawing
     */
    function drawPartnerWithChildren(
        d,
        f,
        i,
        pi,
        ci,
        h,
        dr,
        fx,
        cy,
        ly,
        uy,
        fl,
        pg,
        dp,
        ax,
        pcx,
        excludeParent,
    ) {
        const g = calculateMarriageGap(f, i, pi, pg);
        let px; // Declare px at function scope
        if (ci.length) {
            const ds = buildChildrenGroup(
                f,
                i,
                ci,
                h,
                fl,
                pg,
                dp,
                excludeParent,
            );
            const cx = dr ? d.r - ds.fl + ds.aw / 2 : d.l - ds.lr - ds.aw / 2;
            px = cx + (dr ? 0.5 : -0.5);
            drawChildrenGroup(
                d,
                ds,
                cx,
                cy + 1,
                pi && f[pi] ? cx : fx,
                ly,
                pi === null ? -0.15 : 0,
            );
        } else {
            px = dr ? d.r : d.l - 1;
        }
        if (pi) {
            pcx[pi] = px - (dr ? 0.5 : -0.5);
        }
        if (pi && f[pi]) {
            const s = isCurrentPartnership(f, i, pi) ? "S" : "P";
            if (ax.length) {
                const xo = dr ? 0.5 : -0.5;
                const x1 = ax[0] - xo * (1 + ax.length / 10);
                const x2 = ax[ax.length - 1] + xo + xo / 10;
                addLine(d, fx, ly, x1, ly, s);
                addLine(d, x1, ly, x1, uy, s);
                addLine(d, x1, uy, x2, uy, s);
                addLine(d, x2, uy, x2, ly, s);
                addLine(d, x2, ly, px, ly, s);
                if (Math.abs(px - x2) >= g - 1) {
                    addPartnerLabel(
                        d,
                        i,
                        pi,
                        x2 + (dr ? -0.5 : 0.5),
                        px,
                        ly,
                        false,
                    );
                } else {
                    addPartnerLabel(
                        d,
                        i,
                        pi,
                        x2 + (dr ? -1.5 : -0.5),
                        x2 + (dr ? 0.5 : 1.5),
                        uy,
                        true,
                    );
                }
            } else {
                addLine(d, fx, ly, px, ly, s);
                addPartnerLabel(d, i, pi, fx, px, ly, true);
            }
            addPersonBox(d, f, pi, i, px, cy, true, dr, true);
            ax[ax.length] = px;
        }
    }

    /**
     * Build children group (prepare children trees for rendering)
     * @param {Object} f - Family data
     * @param {string} pi - Parent ID
     * @param {Array} ci - Children IDs
     * @param {number} h - Depth
     * @param {boolean} fl - Flip layout
     * @param {Object} pg - Display options
     * @param {Object} dp - Duplicate tracking
     * @param {string} excludeParent - Parent ID to exclude from m2/f2/m3/f3 line drawing
     * @returns {Object} Children group data
     */
    function buildChildrenGroup(f, pi, ci, h, fl, pg, dp, excludeParent) {
        const ds = [],
            ss = [],
            gs = [];
        let tw = 0;
        for (let j = 0; j < ci.length; j++) {
            const i = ci[j];
            const p = f[i];
            const d = buildDescendantTree(f, i, h, fl, pg, dp);
            const pr = p.m1 === pi || p.f1 === pi;
            const gr = isNonBiological(p, pi);
            // Draw line to second parent set if it exists and is not the current parent or excluded parent
            if (
                (p.m2 || p.f2) &&
                p.m2 !== pi &&
                p.f2 !== pi &&
                (!excludeParent ||
                    (p.m2 !== excludeParent && p.f2 !== excludeParent))
            ) {
                addLine(
                    d,
                    pr ? 0.05 : -0.05,
                    0,
                    pr ? 0.05 : -0.05,
                    -0.55,
                    gr ? "b" : "c",
                );
            }
            // Draw line to third parent set if it exists and is not the current parent or excluded parent
            if (
                (p.m3 || p.f3) &&
                p.m3 !== pi &&
                p.f3 !== pi &&
                (!excludeParent ||
                    (p.m3 !== excludeParent && p.f3 !== excludeParent))
            ) {
                addLine(
                    d,
                    pr ? 0.1 : -0.1,
                    0,
                    pr ? 0.1 : -0.1,
                    -0.6,
                    gr ? "b" : "c",
                );
            }
            ds[ds.length] = d;
            ss[ss.length] = !pr;
            gs[gs.length] = gr;
            tw += d.w;
        }
        const fl_val = ds[0].l;
        const lr = ds[ds.length - 1].r;
        return {
            ds: ds,
            ss: ss,
            gs: gs,
            tw: tw,
            fl: fl_val,
            lr: lr,
            aw: tw + fl_val - lr,
        };
    }

    /**
     * Draw children group (position and connect children)
     * @param {Object} d - Tree data
     * @param {Object} dd - Children group data
     * @param {number} cx - Center X
     * @param {number} cy - Children Y
     * @param {number} vx - Vertical line X
     * @param {number} vy - Vertical line Y
     * @param {number} yo - Y offset
     */
    function drawChildrenGroup(d, dd, cx, cy, vx, vy, yo) {
        const ds = dd.ds;
        const gs = dd.gs;
        const aw = dd.aw;
        const ax = [];
        let x = cx - aw / 2 + dd.fl;
        for (let j = 0; j < ds.length; j++) {
            const cd = ds[j];
            ax[j] = x - cd.l;
            mergeTreeData(d, cd, ax[j], cy);
            x += cd.w;
        }
        drawChildrenLines(d, vx, ax, vy, cy, gs, yo);
    }

    /**
     * Split siblings into left and right sides
     * @param {Object} d - Tree data
     * @param {Object} f - Family data
     * @param {Object} p - Person object
     * @param {Array} si - Sibling IDs
     * @param {number} h - Depth
     * @param {boolean|null} dr - Direction (true=right, false=left, null=auto)
     * @param {number} cy - Current Y position
     * @param {boolean} fl - Flip layout
     * @param {Object} pg - Display options
     * @param {Object} dp - Duplicate tracking
     * @returns {Object} Object with al, ar, ap, ll, rl properties
     */
    function splitSiblings(d, f, p, si, h, dr, cy, fl, pg, dp) {
        const li = [],
            ri = [];
        for (let j = 0; j < si.length; j++) {
            const r = dr === null ? comparePeople(p, f[si[j]]) < 0 : dr;
            if (r) {
                ri[ri.length] = si[j];
            } else {
                li[li.length] = si[j];
            }
        }
        const apl = drawSiblingsOneSide(d, f, p, li, h, false, cy, fl, pg, dp);
        const apr = drawSiblingsOneSide(d, f, p, ri, h, true, cy, fl, pg, dp);
        const al = apl[""];
        const ar = apr[""];
        const ap = apl;
        for (const j in apr) {
            ap[j] = apr[j];
        }
        return { al: al, ar: ar, ap: ap, ll: li.length, rl: ri.length };
    }

    /**
     * Draw siblings on one side
     * @param {Object} d - Tree data
     * @param {Object} f - Family data
     * @param {Object} p - Person object
     * @param {Array} si - Sibling IDs
     * @param {number} h - Depth
     * @param {boolean} dr - Direction (true=right, false=left)
     * @param {number} cy - Current Y position
     * @param {boolean} fl - Flip layout
     * @param {Object} pg - Display options
     * @param {Object} dp - Duplicate tracking
     * @returns {Object} Position map
     */
    function drawSiblingsOneSide(d, f, p, si, h, dr, cy, fl, pg, dp) {
        const al = { "": 0 };
        for (let j = 0; j < si.length; j++) {
            const k = dr ? j : si.length - j - 1;
            const sd = buildDescendantTree(f, si[k], h, fl, pg, dp);
            if (sd.h === 1) {
                // Use per-level boundaries if available, otherwise use overall boundaries
                const rightBound = d.yr[cy] !== undefined ? d.yr[cy] : d.r;
                const leftBound = d.yl[cy] !== undefined ? d.yl[cy] : d.l;
                var x = dr ? rightBound - sd.l : leftBound - sd.r;
            } else {
                var x = dr ? d.r - sd.l : d.l - sd.r;
            }
            mergeTreeData(d, sd, x, cy);
            if (f[si[k]].m2 || f[si[k]].f2) {
                addLine(
                    d,
                    x + 0.05,
                    cy,
                    x + 0.05,
                    cy - 0.45,
                    isNonBiological(f[si[k]], p.m1 || p.f1) ? "b" : "c",
                );
            }
            al[f[si[k]].i] = x;
            al[""] = x;
        }
        return al;
    }

    /**
     * Build tree for a person and descendants
     * @param {Object} f - Family data
     * @param {string} i - Person ID
     * @param {number} h - Height (depth) to render
     * @param {boolean} fl - Flip layout
     * @param {Object} pg - Display options
     * @param {Object} dp - Duplicate tracking
     * @returns {Object} Tree data
     */
    function buildDescendantTree(f, i, h, fl, pg, dp) {
        const p = f[i];
        const d = createTreeData();

        console.log(
            "=== FamilyTreeLayout: buildDescendantTree called (v4) ===",
            {
                personId: i,
                personName: p?.p,
                depth: h,
                hasSpouse: !!p?.es,
                spouseId: p?.es,
                personData: p,
            },
        );

        // Safety check: if person doesn't exist, return empty tree
        if (!p) {
            console.warn(
                `buildDescendantTree: Person ${i} not found in family data`,
            );
            return d;
        }

        let sr = getSpouseSide(f, i, p.es);
        const g = calculateMarriageGap(f, i, p.es, pg);
        if (fl) {
            sr = !sr;
        }
        const sx = sr ? g : -g;

        if (h > 0) {
            console.log("FamilyTreeLayout: Processing person with depth > 0", {
                personId: i,
                depth: h,
                hasSpouse: !!p.es,
            });
            addEntity(d, i, p, 0, 0);

            // Get all children
            const c = p.c.slice();
            if (p.es) {
                addUniqueToArray(c, f[p.es].c);
            }

            // Categorize children by their parent sets
            const childrenOfPerson = []; // _e4: children whose first parent is current person
            const childrenOfSpouse = []; // _e3: children whose first parent is spouse
            const childrenWithSpouseAs2nd = []; // _e6: children with spouse as 2nd/3rd parent
            const childrenWithPersonAs2nd = []; // _e5: children with person as 2nd/3rd parent
            const spouseChildPositions = {}; // _e7: X positions for spouse's children
            const personChildPositions = {}; // _e8: X positions for person's children

            for (let j = 0; j < c.length; j++) {
                const ci = c[j];
                const cp = f[ci];
                if (cp.m1 === i || cp.f1 === i) {
                    childrenOfPerson.push(ci);
                    if (p.es) {
                        if (cp.m2 === p.es || cp.f2 === p.es) {
                            childrenWithSpouseAs2nd.push({ j: 2, i: ci });
                        } else if (cp.m3 === p.es || cp.f3 === p.es) {
                            childrenWithSpouseAs2nd.push({ j: 3, i: ci });
                        }
                    }
                } else if (p.es && (cp.m1 === p.es || cp.f1 === p.es)) {
                    childrenOfSpouse.push(ci);
                    if (cp.m2 === i || cp.f2 === i) {
                        childrenWithPersonAs2nd.push({ j: 2, i: ci });
                    } else if (cp.m3 === i || cp.f3 === i) {
                        childrenWithPersonAs2nd.push({ j: 3, i: ci });
                    }
                } else {
                    // Child with neither as first parent
                    if (
                        cp.m2 === i ||
                        cp.f2 === i ||
                        cp.m3 === i ||
                        cp.f3 === i
                    ) {
                        childrenOfPerson.push(ci);
                    } else {
                        childrenOfSpouse.push(ci);
                    }
                }
            }

            // Process alone children (excluding spouse's children)
            let ac = getAloneChildren(f, i);
            ac = ac.filter((childId) => !childrenOfSpouse.includes(childId));
            spouseChildPositions[""] = 0;

            if (ac.length) {
                if (dp.c[i]) {
                    addAloneChildrenStub(d, f, i, 0, 0);
                } else {
                    dp.c[i] = true;
                    const ds = buildChildrenGroup(
                        f,
                        i,
                        ac,
                        h - 1,
                        fl,
                        pg,
                        dp,
                        p.es,
                    );
                    placeChildrenGroup(d, ds, 0, 1, 0, 0, 0);
                }
            }

            // Process spouse
            if (p.es) {
                console.log("FamilyTreeLayout: Processing spouse (v3)", {
                    personId: i,
                    spouseId: p.es,
                    alreadyProcessed: !!dp.p[i + "-" + p.es],
                    spouseExists: !!f[p.es],
                    spouseData: f[p.es],
                });
                if (dp.p[i + "-" + p.es]) {
                    console.log(
                        "FamilyTreeLayout: Spouse already processed, adding line only",
                    );
                    addLine(
                        d,
                        0,
                        0,
                        sr ? 0.475 : -0.475,
                        0,
                        isCurrentPartnership(f, i, p.es) ? "s" : "p",
                    );
                } else {
                    console.log(
                        "FamilyTreeLayout: Processing spouse for first time",
                    );
                    dp.p[i + "-" + p.es] = true;
                    dp.p[p.es + "-" + i] = true;

                    let tc = getPartnerChildren(f, i, p.es);
                    tc = tc.filter(
                        (childId) => !childrenOfSpouse.includes(childId),
                    );

                    console.log("FamilyTreeLayout: Partner children (v3)", {
                        personId: i,
                        spouseId: p.es,
                        partnerChildren: tc.length,
                        childrenOfSpouse: childrenOfSpouse.length,
                        allChildrenOfPerson: f[i].c,
                        allChildrenOfSpouse: f[p.es].c,
                    });

                    if (tc.length) {
                        const ds = buildChildrenGroup(
                            f,
                            i,
                            tc,
                            h - 1,
                            fl,
                            pg,
                            dp,
                            null,
                        );
                        let cx;
                        if (ac.length) {
                            cx = sr
                                ? Math.max(
                                    g,
                                    d.r + (ds.tw - ds.fl - ds.lr) / 2 + 0.5,
                                )
                                : Math.min(
                                    -g,
                                    d.l - (ds.tw + ds.lr + ds.fl) / 2 - 0.5,
                                );
                            cx = sr ? cx - 0.5 : cx + 0.5;
                        } else {
                            cx = sr ? sx - g / 2 : sx + g / 2;
                        }
                        placeChildrenGroup(d, ds, cx, 1, cx, 0, 0);
                        spouseChildPositions[p.es] = cx;
                        personChildPositions[i] = cx;
                    }

                    console.log(
                        "FamilyTreeLayout: About to add spouse entity (v3)",
                        {
                            personId: i,
                            spouseId: p.es,
                            position: { x: sx, y: 0 },
                            entitiesBeforeAdd: Object.keys(d.e).length,
                        },
                    );

                    addLine(
                        d,
                        0,
                        0,
                        sx,
                        0,
                        isCurrentPartnership(f, i, p.es) ? "S" : "P",
                    );
                    addPartnerLabel(d, i, p.es, 0, sx, 0, false);
                    addPersonBox(d, f, p.es, i, sx, 0, true, null, false);
                    personChildPositions[""] = sx;

                    console.log("FamilyTreeLayout: Spouse entity added (v3)", {
                        personId: i,
                        spouseId: p.es,
                        entitiesAfterAdd: Object.keys(d.e).length,
                        spouseEntityExists: !!d.e[p.es],
                    });

                    // Process spouse's alone children (excluding person's children)
                    let pac = getAloneChildren(f, p.es);
                    pac = pac.filter(
                        (childId) => !childrenOfPerson.includes(childId),
                    );

                    if (pac.length) {
                        if (dp.c[p.es]) {
                            addAloneChildrenStub(d, f, p.es, sx, 0);
                        } else {
                            dp.c[p.es] = true;
                            const ds = buildChildrenGroup(
                                f,
                                p.es,
                                pac,
                                h - 1,
                                fl,
                                pg,
                                dp,
                                null,
                            );
                            placeChildrenGroup(
                                d,
                                ds,
                                sr
                                    ? d.r + (ds.tw - ds.fl - ds.lr) / 2
                                    : d.l - (ds.tw + ds.lr + ds.fl) / 2,
                                1,
                                sx,
                                0,
                                -0.15,
                            );
                        }
                    }

                    // Draw additional spouses for spouse
                    drawAdditionalSpouses(
                        d,
                        f,
                        p.es,
                        i,
                        h - 1,
                        sr,
                        sx,
                        0,
                        fl,
                        pg,
                        dp,
                        childrenOfPerson,
                        personChildPositions,
                        i,
                    );
                }
            }

            // Draw additional spouses for person
            drawAdditionalSpouses(
                d,
                f,
                i,
                p.es,
                h - 1,
                !sr,
                0,
                0,
                fl,
                pg,
                dp,
                childrenOfSpouse,
                spouseChildPositions,
                p.es,
            );

            // Draw lines for children with second/third parent sets
            for (let k = 2; k <= 3; k++) {
                const oxy = (k - 1) * 0.05;
                for (let j = 0; j < childrenWithPersonAs2nd.length; j++) {
                    if (childrenWithPersonAs2nd[j].j === k) {
                        const ci = childrenWithPersonAs2nd[j].i;
                        if (d.e[ci]) {
                            const op =
                                f[ci]["m" + k] === i
                                    ? f[ci]["f" + k]
                                    : f[ci]["m" + k];
                            drawChildrenLines(
                                d,
                                spouseChildPositions[op || ""] + 0,
                                [d.e[ci].x + oxy],
                                0,
                                1,
                                [isParentSetNonBio(f[ci], k)],
                                -oxy,
                            );
                        }
                    }
                }
                for (let j = 0; j < childrenWithSpouseAs2nd.length; j++) {
                    if (childrenWithSpouseAs2nd[j].j === k) {
                        const ci = childrenWithSpouseAs2nd[j].i;
                        if (d.e[ci]) {
                            const op =
                                f[ci]["m" + k] === p.es
                                    ? f[ci]["f" + k]
                                    : f[ci]["m" + k];
                            drawChildrenLines(
                                d,
                                personChildPositions[op || ""] + 0,
                                [d.e[ci].x - oxy],
                                0,
                                1,
                                [isParentSetNonBio(f[ci], k)],
                                oxy,
                            );
                        }
                    }
                }
            }
        } else {
            addPersonBox(d, f, i, null, 0, 0, false, sr, true);
        }

        return d;
    }

    /**
     * Place children group in tree
     * @param {Object} d - Tree data
     * @param {Object} dd - Children group data
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} vx - Vertical line X
     * @param {number} vy - Vertical line Y
     * @param {number} yo - Y offset
     */
    function placeChildrenGroup(d, dd, cx, cy, vx, vy, yo) {
        const ds = dd.ds;
        const gs = dd.gs;
        const aw = dd.aw;
        const ax = [];
        let x = cx - aw / 2 + dd.fl;

        for (let j = 0; j < ds.length; j++) {
            const cd = ds[j];
            ax[j] = x - cd.l;
            mergeTreeData(d, cd, ax[j], cy);
            x += cd.w;
        }

        drawChildrenLines(d, vx, ax, vy, cy, gs, yo);
    }

    /**
     * Draw lines connecting children to parents
     * @param {Object} d - Tree data
     * @param {number} vx - Vertical line X
     * @param {Array} ax - Child X positions
     * @param {number} vy - Vertical line start Y
     * @param {number} cy - Child Y
     * @param {Array} gs - Non-biological flags
     * @param {number} yo - Y offset
     */
    function drawChildrenLines(d, vx, ax, vy, cy, gs, yo) {
        let sb = false;
        let sg = false;
        let minB = vx,
            maxB = vx;
        let minG = vx,
            maxG = vx;
        const ay = (vy + cy) / 2 + yo;

        for (let j = 0; j < gs.length; j++) {
            const x = ax[j];
            if (gs[j]) {
                sg = true;
                minG = Math.min(minG, x);
                maxG = Math.max(maxG, x);
            } else {
                sb = true;
                minB = Math.min(minB, x);
                maxB = Math.max(maxB, x);
            }
            addLine(d, x, ay, x, cy, gs[j] ? "C" : "B");
        }

        const minAll = Math.min(minB, minG);
        const maxAll = Math.max(maxB, maxG);

        for (let g = 0; g <= 1; g++) {
            if (g ? sg : sb) {
                const s = g ? "C" : "B";
                if (vx < minAll || vx > maxAll) {
                    const x = vx < minAll ? minAll : maxAll;
                    const y = vy + ay / 2;
                    addLine(d, vx, vy, vx, y, s);
                    addLine(d, vx, y, x, y, s);
                    addLine(d, x, y, x, ay, s);
                } else {
                    addLine(d, vx, vy, vx, ay, s);
                }
                addLine(d, g ? minG : minB, ay, g ? maxG : maxB, ay, s);
            }
        }
    }

    /**
     * Add stub for alone children
     * @param {Object} d - Tree data
     * @param {Object} f - Family data
     * @param {string} i - Person ID
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    function addAloneChildrenStub(d, f, i, x, y) {
        const ac = getAloneChildren(f, i);
        if (ac.length) {
            let sb = false;
            let sg = false;
            for (let j = 0; j < ac.length; j++) {
                if (isNonBiological(f[ac[j]], i)) {
                    sg = true;
                } else {
                    sb = true;
                }
            }
            if (sb) {
                addLine(d, x, y, x, y + 0.35, "b");
            }
            if (sg) {
                addLine(d, x, y, x, y + 0.35, "c");
            }
        }
    }

    /**
     * Build parent siblings (aunts/uncles)
     */
    function buildParentSiblings(d, f, pi, oi, ph, h, dr, fx, fl, pg, dp) {
        const p = f[pi];
        if (p.m1 || p.f1) {
            if (p.m2 || p.f2) {
                addLine(
                    d,
                    fx + 0.05,
                    -1,
                    fx + 0.05,
                    -1.45,
                    isParentSetNonBio(p, 2) ? "c" : "b",
                );
            }
            if (ph <= 1) {
                addLine(
                    d,
                    fx,
                    -1,
                    fx,
                    -1.4,
                    isParentSetNonBio(p, 1) ? "c" : "b",
                );
            } else {
                const gs = [isNonBiological(p, p.m1 || p.f1)];
                const ax = [fx];
                let bx = fx;
                const od = oi && f[oi] && (f[oi].f1 || f[oi].m1);
                if (h > 0) {
                    const bs = getSiblings(f, pi, 1);
                    if (bs.length) {
                        if (od) {
                            var aa = splitSiblings(
                                d,
                                f,
                                p,
                                bs,
                                h - 1,
                                dr,
                                -1,
                                fl,
                                pg,
                                dp,
                            );
                        } else {
                            var aa = splitSiblings(
                                d,
                                f,
                                p,
                                bs,
                                h - 1,
                                null,
                                -1,
                                fl,
                                pg,
                                dp,
                            );
                            const al = aa.ll ? aa.al : fx;
                            const ar = aa.rl ? aa.ar : fx;
                            bx = (al + ar) / 2;
                            if (Math.abs(bx - fx) > Btc.pd) {
                                bx = fx + 0.5 * (aa.rl - aa.ll);
                            }
                        }
                        const ap = aa.ap;
                        for (let j = 0; j < bs.length; j++) {
                            gs[gs.length] = isNonBiological(
                                f[bs[j]],
                                p.m1 || p.f1,
                            );
                            ax[ax.length] = ap[bs[j]];
                        }
                    }
                }
                const ad = buildAncestorTree(
                    f,
                    pi,
                    ph - 1,
                    od ? dr : null,
                    h <= 0,
                    fl,
                    pg,
                    dp,
                );
                mergeTreeData(d, ad, bx, -1);
                if (h > 0) {
                    drawChildrenLines(
                        d,
                        bx + (ad.yl[-1] + ad.yr[-1] - 1) / 2,
                        ax,
                        -2,
                        -1,
                        gs,
                        0,
                    );
                }
            }
        }
    }

    /**
     * Build ancestor tree recursively
     */
    function buildAncestorTree(f, i, h, dr, da, fl, pg, dp) {
        const d = createTreeData();
        const p = f[i];

        // Safety check: if person doesn't exist, return empty tree
        if (!p) {
            console.warn(
                `buildAncestorTree: Person ${i} not found in family data`,
            );
            return d;
        }

        if (h > 0 && !dp.a[i]) {
            dp.a[i] = true;
            let x1 = 0;
            let x2 = 0;
            if (p.m1 || p.f1) {
                if (p.m1 && p.f1) {
                    const g = calculateMarriageGap(f, p.m1, p.f1, pg);
                    if (dr === null) {
                        var m1 = !fl;
                        var d1 = false,
                            d2 = true;
                        x1 -= g / 2;
                    } else {
                        var m1 = fl ? !dr : dr;
                        var d1 = dr,
                            d2 = dr;
                    }
                    const i1 = m1 ? p.m1 : p.f1;
                    const i2 = m1 ? p.f1 : p.m1;
                    mergeTreeData(
                        d,
                        buildAncestorTree(f, i1, h - 1, d1, true, fl, pg, dp),
                        x1,
                        -1,
                    );
                    addPersonBox(d, f, i1, i2, x1, -1, false, d1, true);
                    x2 = d2 ? d.r + g - 1 : d.l - g;
                    mergeTreeData(
                        d,
                        buildAncestorTree(f, i2, h - 1, d2, true, fl, pg, dp),
                        x2,
                        -1,
                    );
                    addPersonBox(d, f, i2, i1, x2, -1, false, d2, true);
                    addLine(
                        d,
                        x1,
                        -1,
                        x2,
                        -1,
                        isCurrentPartnership(f, i1, i2) ? "S" : "P",
                    );
                    addPartnerLabel(d, i1, i2, x1, x2, -1, false);
                } else {
                    const pi = p.m1 || p.f1;
                    mergeTreeData(
                        d,
                        buildAncestorTree(f, pi, h - 1, dr, true, fl, pg, dp),
                        x1,
                        -1,
                    );
                    addPersonBox(
                        d,
                        f,
                        pi,
                        null,
                        x1,
                        -1,
                        false,
                        f[pi].g !== (fl ? "f" : "m"),
                        false,
                    );
                }
                if (da) {
                    const gr = isParentSetNonBio(p, 1);
                    const x = (x1 + x2) / 2;
                    addLine(d, x, -0.5, x, -1, gr ? "C" : "B");
                    addLine(d, x, -0.5, 0, -0.5, gr ? "C" : "B");
                    addLine(d, 0, -0.5, 0, 0, gr ? "C" : "B");
                    const bs = getSiblings(f, i, 1);
                    if (bs.length) {
                        let sl = false;
                        let sr = false;
                        if (dr === null || !p.m1 || !p.f1) {
                            for (let j = 0; j < bs.length; j++) {
                                if (comparePeople(p, f[bs[j]]) < 0) {
                                    sr = true;
                                } else {
                                    sl = true;
                                }
                            }
                        } else {
                            if (dr) {
                                sr = true;
                            } else {
                                sl = true;
                            }
                        }
                        const lx = x - (sl ? (sr ? 0.05 : 0.1) : 0);
                        addLine(d, lx, -0.5, lx + 0.1, -0.5, gr ? "c" : "b");
                    }
                }
            }
        } else {
            if (p.m1 || p.f1) {
                addLine(d, 0, -0.4, 0, 0, isParentSetNonBio(p, 1) ? "c" : "b");
            }
        }
        if (da && (p.m2 || p.f2)) {
            addLine(
                d,
                0.05,
                -0.45,
                0.05,
                0,
                isParentSetNonBio(p, 2) ? "c" : "b",
            );
        }
        return d;
    }

    /**
     * Get hidden center person
     */
    function getHiddenCenter(f, i) {
        const p = f[i];
        if (p) {
            const hc = p.es;
            const ac = getAloneChildren(f, i);
            if (
                hc &&
                !p.m1 &&
                !p.f1 &&
                p.pc[hc] &&
                p.cp === 1 &&
                ac.length === 0
            ) {
                return hc;
            }
        }
        return null;
    }

    // Cache for tree generation
    let cacheKey = null;
    let cacheTree = null;
    let cacheDataSig = null;

    /**
     * Main tree generation function (Build Full Tree)
     */
    function buildFullTree(f, i, m, ch, ph, oh, fl, pg) {
        console.log("=== buildFullTree called (v4) ===", {
            personId: i,
            personName: f[i]?.p,
            childDepth: ch,
            parentDepth: ph,
            siblingDepth: oh,
        });

        const hi = JSON.stringify([i, m, ch, ph, oh, fl, pg, cacheDataSig]);
        if (cacheKey === hi) {
            console.log("buildFullTree: Using cached tree");
            return cacheTree;
        }
        const p = f[i];
        const hc = getHiddenCenter(f, i);

        console.log("buildFullTree: Hidden center check", {
            personId: i,
            hasHiddenCenter: !!hc,
            hiddenCenterId: hc,
        });

        let d;
        if (ch && hc && !getHiddenCenter(f, hc)) {
            console.log("buildFullTree: Using hidden center path");
            d = createTreeData();
            const od = buildFullTree(f, hc, m, ch, ph, oh, fl, pg);
            mergeTreeData(d, od, -od.e[i].x, -od.e[i].y);
            d.e[hc].k = false;
        } else {
            console.log("buildFullTree: Using buildDescendantTree path");
            const dp = { a: {}, p: {}, c: {} };
            d = buildDescendantTree(f, i, ch, fl, pg, dp);
            if (ph > 0) {
                let px = 0;
                const gs = [isParentSetNonBio(p, 1)];
                const ax = [0];
                const bs = getSiblings(f, i, 1);
                console.log("buildFullTree: Siblings check", {
                    personId: i,
                    siblingDepth: oh,
                    siblingsCount: bs.length,
                    bs,
                });
                if (bs.length) {
                    const aa = splitSiblings(
                        d,
                        f,
                        p,
                        bs,
                        oh,
                        null,
                        0,
                        fl,
                        pg,
                        dp,
                    );
                    px = (aa.al + aa.ar) / 2;
                    if (Math.abs(px) > Btc.pd) {
                        px = 0.5 * (aa.rl - aa.ll);
                    }
                    for (let j = 0; j < bs.length; j++) {
                        gs[gs.length] = isNonBiological(f[bs[j]], p.m1 || p.f1);
                        ax[ax.length] = aa.ap[bs[j]];
                    }
                }
                console.log("buildFullTree: Parent render check", {
                    personId: i,
                    parentDepth: ph,
                    hasParents: !!(p.m1 || p.f1),
                    m1: p.m1,
                    f1: p.f1,
                });
                if (p.m1 || p.f1) {
                    let mx = px,
                        fx = px;
                    const p2 = p.m2 || p.f2;
                    drawChildrenLines(d, px, ax, -1, 0, gs, 0);
                    if (p.m1 && p.f1) {
                        dp.p[p.m1 + "-" + p.f1] = true;
                        dp.p[p.f1 + "-" + p.m1] = true;
                        const o = calculateMarriageGap(f, p.m1, p.f1, pg) / 2;
                        mx += fl ? o : -o;
                        fx += fl ? -o : o;
                        addLine(
                            d,
                            mx,
                            -1,
                            fx,
                            -1,
                            isCurrentPartnership(f, p.m1, p.f1) ? "S" : "P",
                        );
                        addPartnerLabel(d, p.m1, p.f1, mx, fx, -1, false);
                    }
                    if (p.m1) {
                        addPersonBox(
                            d,
                            f,
                            p.m1,
                            p.f1,
                            mx,
                            -1,
                            false,
                            p2 ? fl : null,
                            p2,
                        );
                    }
                    if (p.f1) {
                        addPersonBox(
                            d,
                            f,
                            p.f1,
                            p.m1,
                            fx,
                            -1,
                            false,
                            p2 ? !fl : null,
                            p2,
                        );
                    }
                    if (!p2) {
                        if (p.m1) {
                            const ac = getAloneChildren(f, p.m1);
                            if (ac.length && p.f1) {
                                drawPartnerWithChildren(
                                    d,
                                    f,
                                    p.m1,
                                    null,
                                    ac,
                                    oh,
                                    fl,
                                    mx,
                                    -1,
                                    -1,
                                    -1,
                                    fl,
                                    pg,
                                    dp,
                                    [],
                                    {},
                                    null,
                                );
                            }
                            drawAdditionalSpouses(
                                d,
                                f,
                                p.m1,
                                p.f1,
                                oh,
                                fl,
                                mx,
                                -1,
                                fl,
                                pg,
                                dp,
                                [],
                                {},
                                null,
                            );
                        }
                        if (p.f1) {
                            const ac = getAloneChildren(f, p.f1);
                            if (ac.length && p.m1) {
                                drawPartnerWithChildren(
                                    d,
                                    f,
                                    p.f1,
                                    null,
                                    ac,
                                    oh,
                                    !fl,
                                    fx,
                                    -1,
                                    -1,
                                    -1,
                                    fl,
                                    pg,
                                    dp,
                                    [],
                                    {},
                                    null,
                                );
                            }
                            drawAdditionalSpouses(
                                d,
                                f,
                                p.f1,
                                p.m1,
                                oh,
                                !fl,
                                fx,
                                -1,
                                fl,
                                pg,
                                dp,
                                [],
                                {},
                                null,
                            );
                        }
                    }
                    if (p.m1) {
                        buildParentSiblings(
                            d,
                            f,
                            p.m1,
                            p.f1,
                            ph,
                            oh,
                            fl,
                            mx,
                            fl,
                            pg,
                            dp,
                        );
                    }
                    if (p.f1) {
                        buildParentSiblings(
                            d,
                            f,
                            p.f1,
                            p.m1,
                            ph,
                            oh,
                            !fl,
                            fx,
                            fl,
                            pg,
                            dp,
                        );
                    }
                } else {
                    console.log(
                        "buildFullTree: No parents found for current person; skipping parent rendering",
                        { personId: i },
                    );
                }
            } else {
                console.log(
                    "buildFullTree: parentDepth <= 0; skipping parent rendering section",
                    { personId: i, parentDepth: ph },
                );
                if (p.m1 || p.f1) {
                    addLine(
                        d,
                        0,
                        0,
                        0,
                        -0.425,
                        isParentSetNonBio(p, 1) ? "c" : "b",
                    );
                    if (p.m2 || p.f2) {
                        addLine(
                            d,
                            0.05,
                            0,
                            0.05,
                            -0.45,
                            isParentSetNonBio(p, 2) ? "c" : "b",
                        );
                    }
                }
            }
        }
        d.e[i].k = true;
        if (m && d.e[m]) {
            d.e[m].m = true;
        }
        cacheKey = hi;
        cacheTree = d;
        return d;
    }

    // ============================================================================
    // PUBLIC API
    // ============================================================================

    /**
     * Generate family tree layout
     *
     * @param {Object} familyData - Family data object where keys are person IDs
     * @param {string} rootPersonId - ID of the root person to center the tree on
     * @param {Object} options - Layout options
     * @param {number} [options.childDepth=3] - How many generations of descendants to show
     * @param {number} [options.parentDepth=0] - How many generations of ancestors to show
     * @param {number} [options.siblingDepth=0] - How many generations of siblings to show
     * @param {boolean} [options.flipLayout=false] - Flip the layout horizontally
     * @param {Object} [options.displayOptions={}] - Display options for marriage dates, etc.
     * @param {boolean} [options.displayOptions.m=false] - Show marriage dates
     * @param {boolean} [options.displayOptions.w=false] - Show wedding info
     * @param {boolean} [options.displayOptions.d=false] - Show divorce dates
     *
     * @returns {Object} Tree layout data with the following structure:
     * @returns {Object} returns.e - Entities (person boxes) keyed by person ID
     * @returns {Array} returns.n - Array of line objects {x1, y1, x2, y2, t, c}
     * @returns {Array} returns.p - Array of partner label objects {i, si, x1, x2, y, b}
     * @returns {number} returns.l - Left boundary
     * @returns {number} returns.r - Right boundary
     * @returns {number} returns.t - Top boundary
     * @returns {number} returns.b - Bottom boundary
     * @returns {number} returns.w - Width
     * @returns {number} returns.h - Height
     *
     * @example
     * // Basic usage
     * const familyData = {
     *   'p1': { i: 'p1', p: 'John Doe', g: 'm', b: '19800101', c: [], pc: {}, es: null },
     *   'p2': { i: 'p2', p: 'Jane Smith', g: 'f', b: '19820315', c: [], pc: {}, es: null }
     * };
     *
     * const layout = FamilyTreeLayout.generateLayout(familyData, 'p1', {
     *   childDepth: 3,
     *   parentDepth: 2,
     *   flipLayout: false
     * });
     *
     * // Access person positions
     * console.log(layout.e['p1']); // { p: {...}, x: 0, y: 0, k: true }
     *
     * // Access connecting lines
     * layout.n.forEach(line => {
     *   console.log(`Line from (${line.x1}, ${line.y1}) to (${line.x2}, ${line.y2})`);
     * });

     */
    function generateLayout(familyData, rootPersonId, options) {
        console.log("=== FamilyTreeLayout.generateLayout CALLED (v2) ===", {
            rootPersonId,
            peopleCount: Object.keys(familyData).length,
            people: Object.keys(familyData).map((id) => ({
                id,
                name: familyData[id].p,
                hasSpouse: !!familyData[id].es,
                spouseId: familyData[id].es,
                childrenCount: familyData[id].c?.length || 0,
            })),
            options,
        });

        options = options || {};
        // Compute a light-weight signature of the family data so cache invalidates when data changes
        function computeDataSig(f) {
            try {
                const ids = Object.keys(f).sort();
                const parts = ids.map((id) => {
                    const p = f[id] || {};
                    const cLen = (p.c && p.c.length) || 0;
                    const pcLen = p.pc ? Object.keys(p.pc).length : 0;
                    return (
                        id +
                        ":" +
                        (p.cp || 0) +
                        ":" +
                        (p.es || "") +
                        ":" +
                        cLen +
                        ":" +
                        (p.m1 || "") +
                        ":" +
                        (p.f1 || "") +
                        ":" +
                        pcLen
                    );
                });
                return ids.length + "|" + parts.join(",");
            } catch (e) {
                return String(Date.now());
            }
        }

        const childDepth =
            options.childDepth !== undefined ? options.childDepth : 3;
        const parentDepth =
            options.parentDepth !== undefined ? options.parentDepth : 0;
        const siblingDepth =
            options.siblingDepth !== undefined ? options.siblingDepth : 0;
        const flipLayout = options.flipLayout || false;
        const displayOptions = options.displayOptions || {};
        const markedPersonId = options.markedPersonId || null;

        console.log("FamilyTreeLayout: Calling buildFullTree", {
            rootPersonId,
            childDepth,
            parentDepth,
            siblingDepth,
        });

        // Update cache signature for current family data
        cacheDataSig = computeDataSig(familyData);
        console.log("FamilyTreeLayout: Data signature for cache", cacheDataSig);

        // Build the full tree using the main algorithm
        const treeData = buildFullTree(
            familyData,
            rootPersonId,
            markedPersonId,
            childDepth,
            parentDepth,
            siblingDepth,
            flipLayout,
            displayOptions,
        );

        console.log("FamilyTreeLayout: buildFullTree returned", {
            entitiesCount: Object.keys(treeData.e || {}).length,
            linesCount: treeData.n?.length || 0,
        });

        return treeData;
    }

    /**
     * Prepare family data for layout algorithm
     * This function should be called before generateLayout to ensure all required fields exist
     *
     * @param {Object} familyData - Raw family data
     * @returns {Object} Prepared family data with all required fields
     *
     * @example
     * const rawData = {
     *   'p1': { i: 'p1', p: 'John Doe', g: 'm', b: '19800101' }
     * };
     * const preparedData = FamilyTreeLayout.prepareData(rawData);
     */
    function prepareData(familyData) {
        const prepared = {};

        for (const id in familyData) {
            const person = familyData[id];
            prepared[id] = {
                i: person.i || id,
                p: person.p || "", // name
                g: person.g || "", // gender
                b: person.b || "", // birth date
                d: person.d || "", // death date
                c: person.c || [], // children array
                pc: person.pc || {}, // partners object
                es: person.es || null, // primary spouse
                cp: person.cp || 0, // partner count
                m1: person.m1 || null, // mother 1
                f1: person.f1 || null, // father 1
                m2: person.m2 || null, // mother 2
                f2: person.f2 || null, // father 2
                m3: person.m3 || null, // mother 3
                f3: person.f3 || null, // father 3
                t1: person.t1 || null, // relationship type 1
                t2: person.t2 || null, // relationship type 2
                t3: person.t3 || null, // relationship type 3
                s: person.s || null, // current spouse
                ep: person.ep || null, // engaged partners
                gp: person.gp || null, // partner types
                mp: person.mp || null, // marriage dates
                wp: person.wp || null, // wedding info
                dp: person.dp || null, // divorce dates
                bp: person.bp || null, // begin dates
                rp: person.rp || null, // relationship dates
                O: person.O || null, // order
                ai: person.ai || 0, // auto index
            };
        }

        return prepared;
    }

    /**
     * Get line style information
     *
     * @param {string} lineType - Line type code (B, C, P, S, b, c, p, s)
     * @returns {Object} Style information {biological, current, lowercase}
     *
     * Line types:
     * - B/b: Biological parent-child (uppercase=solid, lowercase=dashed)
     * - C/c: Non-biological parent-child (uppercase=solid, lowercase=dashed)
     * - P/p: Partnership line (uppercase=solid, lowercase=dashed)
     * - S/s: Current/married partnership (uppercase=solid, lowercase=dashed)
     */
    function getLineStyle(lineType) {
        return {
            biological: lineType === "B" || lineType === "b",
            nonBiological: lineType === "C" || lineType === "c",
            partnership: lineType === "P" || lineType === "p",
            currentPartnership: lineType === "S" || lineType === "s",
            solid: lineType === lineType.toUpperCase(),
            dashed: lineType === lineType.toLowerCase(),
        };
    }

    // ============================================================================
    // EXPORT PUBLIC API
    // ============================================================================

    var FamilyTreeLayoutAPI = {
        generateLayout: generateLayout,
        prepareData: prepareData,
        getLineStyle: getLineStyle,
        version: "1.0.0",
    };

    return FamilyTreeLayoutAPI;
});

// ES6 default export for modern module systems (Vite, Webpack, etc.)
// This must be outside the UMD wrapper for Vite to recognize it
export default FamilyTreeLayoutModule;