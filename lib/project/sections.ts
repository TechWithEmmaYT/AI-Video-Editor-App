/** Colours new sections cycle through (the editor and Claude's add_section use the same ones). */
export const SECTION_COLORS = ["#8b5cf6", "#3b82f6", "#22c55e", "#14b8a6", "#f59e0b", "#ec4899", "#f97316"]

/** The colour for the next section, given how many there are. */
export const nextSectionColor = (count: number) => SECTION_COLORS[count % SECTION_COLORS.length]
