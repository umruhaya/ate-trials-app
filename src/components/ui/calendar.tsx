import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DayPickerProps } from "react-day-picker";
import { DayPicker } from "react-day-picker";

import "react-day-picker/style.css";

import { cn } from "~/lib/utils";

function Calendar({
	className,
	showOutsideDays = true,
	components,
	...props
}: DayPickerProps) {
	return (
		<DayPicker
			showOutsideDays={showOutsideDays}
			className={cn("p-0", className)}
			components={{
				Chevron: ({ orientation, ...rest }) =>
					orientation === "left" ? (
						<ChevronLeft className="size-4" {...rest} />
					) : (
						<ChevronRight className="size-4" {...rest} />
					),
				...components,
			}}
			{...props}
			style={{
				// Match app theme accents for selection (react-day-picker CSS variables)
				["--rdp-accent-color" as string]: "var(--primary)",
				["--rdp-accent-background-color" as string]:
					"oklch(0.92 0.01 286 / 0.6)",
				...(props.style ?? {}),
			}}
		/>
	);
}

export { Calendar };
