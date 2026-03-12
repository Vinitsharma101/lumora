/**
 * Interval tree for O(log n) active-clip queries.
 *
 * Each node stores a clip's timeline interval [start, end).
 * Query: given a time T, find all clips where start <= T < end.
 *
 * Uses an augmented BST (balanced by insertion order — sufficient
 * for typical timeline sizes of <10 000 clips).
 */

export interface TimeInterval<T = unknown> {
	start: number;
	end: number;
	data: T;
}

interface TreeNode<T> {
	interval: TimeInterval<T>;
	maxEnd: number;
	left: TreeNode<T> | null;
	right: TreeNode<T> | null;
}

export class IntervalTree<T = unknown> {
	private root: TreeNode<T> | null = null;
	private count = 0;

	get size(): number {
		return this.count;
	}

	/** Build tree from a sorted array of intervals (by start). */
	static fromSorted<T>(intervals: TimeInterval<T>[]): IntervalTree<T> {
		const tree = new IntervalTree<T>();
		tree.root = buildBalanced(intervals, 0, intervals.length - 1);
		tree.count = intervals.length;
		return tree;
	}

	/** Build from unsorted intervals. */
	static from<T>(intervals: TimeInterval<T>[]): IntervalTree<T> {
		const sorted = [...intervals].sort((a, b) => a.start - b.start);
		return IntervalTree.fromSorted(sorted);
	}

	/** Insert a single interval. */
	insert(interval: TimeInterval<T>): void {
		this.root = insertNode(this.root, interval);
		this.count++;
	}

	/** Find all intervals containing the point `time`. */
	query(time: number): TimeInterval<T>[] {
		const results: TimeInterval<T>[] = [];
		queryNode(this.root, time, results);
		return results;
	}

	/** Find all intervals overlapping the range [start, end). */
	queryRange(start: number, end: number): TimeInterval<T>[] {
		const results: TimeInterval<T>[] = [];
		queryRangeNode(this.root, start, end, results);
		return results;
	}

	/** Clear the tree. */
	clear(): void {
		this.root = null;
		this.count = 0;
	}
}

function buildBalanced<T>(
	intervals: TimeInterval<T>[],
	lo: number,
	hi: number,
): TreeNode<T> | null {
	if (lo > hi) return null;

	const mid = (lo + hi) >>> 1;
	const node: TreeNode<T> = {
		interval: intervals[mid],
		maxEnd: intervals[mid].end,
		left: buildBalanced(intervals, lo, mid - 1),
		right: buildBalanced(intervals, mid + 1, hi),
	};

	if (node.left) {
		node.maxEnd = Math.max(node.maxEnd, node.left.maxEnd);
	}
	if (node.right) {
		node.maxEnd = Math.max(node.maxEnd, node.right.maxEnd);
	}
	return node;
}

function insertNode<T>(
	node: TreeNode<T> | null,
	interval: TimeInterval<T>,
): TreeNode<T> {
	if (!node) {
		return { interval, maxEnd: interval.end, left: null, right: null };
	}

	if (interval.start < node.interval.start) {
		node.left = insertNode(node.left, interval);
	} else {
		node.right = insertNode(node.right, interval);
	}

	node.maxEnd = Math.max(node.maxEnd, interval.end);
	return node;
}

function queryNode<T>(
	node: TreeNode<T> | null,
	time: number,
	results: TimeInterval<T>[],
): void {
	if (!node) return;

	// If max end of this subtree <= time, nothing here overlaps
	if (node.maxEnd <= time) return;

	// Check left subtree
	queryNode(node.left, time, results);

	// Check this node
	if (node.interval.start <= time && time < node.interval.end) {
		results.push(node.interval);
	}

	// Only check right subtree if its start might be <= time
	if (node.interval.start <= time) {
		queryNode(node.right, time, results);
	}
}

function queryRangeNode<T>(
	node: TreeNode<T> | null,
	start: number,
	end: number,
	results: TimeInterval<T>[],
): void {
	if (!node) return;

	// If max end of subtree <= start, nothing overlaps
	if (node.maxEnd <= start) return;

	queryRangeNode(node.left, start, end, results);

	// Overlap: interval.start < end && interval.end > start
	if (node.interval.start < end && node.interval.end > start) {
		results.push(node.interval);
	}

	// Only check right if start of interval <= end query
	if (node.interval.start < end) {
		queryRangeNode(node.right, start, end, results);
	}
}
