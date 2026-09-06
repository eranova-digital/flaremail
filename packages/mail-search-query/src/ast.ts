export type SearchExpr =
	| { type: "and"; left: SearchExpr; right: SearchExpr }
	| { type: "or"; left: SearchExpr; right: SearchExpr }
	| { type: "not"; expr: SearchExpr }
	| { type: "text"; value: string }
	| { type: "op"; name: string; value: string };

export type ParsedSearchQuery = {
	ast: SearchExpr;
	/** Message-level projection; `null` when the query is thread-only. */
	messageAst: SearchExpr | null;
	hasInOperator: boolean;
};

export function isMessageOnly(expr: SearchExpr): boolean {
	switch (expr.type) {
		case "text":
			return true;
		case "op":
			return expr.name !== "in" && expr.name !== "label" && expr.name !== "is";
		case "not":
			return isMessageOnly(expr.expr);
		case "and":
		case "or":
			return isMessageOnly(expr.left) && isMessageOnly(expr.right);
	}
}

export function containsOperator(expr: SearchExpr, name: string): boolean {
	switch (expr.type) {
		case "text":
			return false;
		case "op":
			return expr.name === name;
		case "not":
			return containsOperator(expr.expr, name);
		case "and":
		case "or":
			return containsOperator(expr.left, name) || containsOperator(expr.right, name);
	}
}

export function stripThreadOperators(expr: SearchExpr): SearchExpr | null {
	switch (expr.type) {
		case "text":
			return expr;
		case "op":
			return expr.name === "in" || expr.name === "label" || expr.name === "is"
				? null
				: expr;
		case "not": {
			const inner = stripThreadOperators(expr.expr);
			return inner ? { type: "not", expr: inner } : null;
		}
		case "and":
		case "or": {
			const left = stripThreadOperators(expr.left);
			const right = stripThreadOperators(expr.right);
			if (!left) {
				return right;
			}
			if (!right) {
				return left;
			}
			return { type: expr.type, left, right };
		}
	}
}
