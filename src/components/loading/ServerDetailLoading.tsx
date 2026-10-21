import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

import { BackIcon } from "../Icon";

const RESOURCE_CHART_SKELETON_CLASS_NAME =
	"h-[302px] w-full min-w-0 rounded-[5px] bg-muted-foreground/10 animate-none";

export function ServerDetailChartLoading() {
	return (
		<div>
			<section className="grid grid-cols-1 gap-3">
				<Skeleton className={RESOURCE_CHART_SKELETON_CLASS_NAME}></Skeleton>
				<Skeleton className={RESOURCE_CHART_SKELETON_CLASS_NAME}></Skeleton>
				<Skeleton className={RESOURCE_CHART_SKELETON_CLASS_NAME}></Skeleton>
				<Skeleton className={RESOURCE_CHART_SKELETON_CLASS_NAME}></Skeleton>
				<Skeleton className={RESOURCE_CHART_SKELETON_CLASS_NAME}></Skeleton>
				<Skeleton className={RESOURCE_CHART_SKELETON_CLASS_NAME}></Skeleton>
			</section>
		</div>
	);
}

export function ServerDetailLoading() {
	const navigate = useNavigate();

	return (
		<div className="mx-auto w-full max-w-5xl px-0">
			<div
				onClick={() => {
					navigate("/");
				}}
				className="flex flex-none cursor-pointer font-semibold leading-none items-center break-all tracking-tight gap-0.5 text-xl"
			>
				<BackIcon />
				<Skeleton className="h-[20px] w-24 rounded-[5px] bg-muted-foreground/10 animate-none"></Skeleton>
			</div>
			<Skeleton className="flex flex-wrap gap-2 h-[81px] w-1/2 mt-3 rounded-[5px] bg-muted-foreground/10 animate-none"></Skeleton>
		</div>
	);
}
