import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ServerDetailChart from "@/components/ServerDetailChart";
import { createServer, createSettingResponse } from "@/test/fixtures";
import { createTestQueryClient } from "@/test/utils";
import type { NezhaServer, NezhaWebsocketResponse } from "@/types/nezha-api";

const detailChartMocks = vi.hoisted(() => ({
	connected: true,
	fetchLoginUser: vi.fn(),
	fetchServerMetrics: vi.fn(),
	fetchSetting: vi.fn(),
	lastData: null as NezhaWebsocketResponse | null,
	messageHistory: [] as NezhaWebsocketResponse[],
}));

vi.mock("recharts", () => {
	const createElement =
		(testId: string) =>
		({
			children,
			data,
			dataKey,
		}: {
			children?: ReactNode;
			data?: unknown[];
			dataKey?: string;
		}) => (
			<div data-key={dataKey} data-points={data?.length} data-testid={testId}>
				{children}
			</div>
		);

	const AreaChart = createElement("area-chart");
	const LineChart = createElement("line-chart");
	const genericChart = createElement("generic-chart");

	return {
		Area: createElement("area"),
		AreaChart,
		BarChart: genericChart,
		CartesianGrid: createElement("grid"),
		ComposedChart: genericChart,
		FunnelChart: genericChart,
		Legend: ({ content }: { content?: ReactNode }) => (
			<div data-testid="chart-legend">{content}</div>
		),
		Line: createElement("line"),
		LineChart,
		PieChart: genericChart,
		RadarChart: genericChart,
		RadialBarChart: genericChart,
		ResponsiveContainer: ({ children }: { children?: ReactNode }) => (
			<div data-testid="responsive-chart">{children}</div>
		),
		Sankey: genericChart,
		ScatterChart: genericChart,
		Tooltip: ({ content }: { content?: ReactNode }) => (
			<div data-testid="chart-tooltip">{content}</div>
		),
		Treemap: genericChart,
		XAxis: createElement("x-axis"),
		YAxis: createElement("y-axis"),
	};
});

vi.mock("@/hooks/use-websocket-context", () => ({
	useWebSocketContext: () => ({
		connected: detailChartMocks.connected,
		lastData: detailChartMocks.lastData,
		messageHistory: detailChartMocks.messageHistory,
	}),
}));

vi.mock("@/lib/nezha-api", () => ({
	fetchLoginUser: detailChartMocks.fetchLoginUser,
	fetchServerMetrics: detailChartMocks.fetchServerMetrics,
	fetchSetting: detailChartMocks.fetchSetting,
}));

function settingResponse(tsdbEnabled = true) {
	return {
		...createSettingResponse(),
		data: {
			...createSettingResponse().data,
			tsdb_enabled: tsdbEnabled,
		},
	};
}

function loginResponse() {
	return {
		success: true,
		data: {
			id: 1,
			username: "admin",
			password: "",
			created_at: "2025-01-01T00:00:00.000Z",
			updated_at: "2025-01-01T00:00:00.000Z",
		},
	};
}

function metricsResponse(metric: string) {
	return {
		success: true,
		data: {
			server_id: 7,
			server_name: "edge-chart-detail",
			metric,
			data_points: [
				{ ts: Date.parse("2025-01-01T00:00:00.000Z"), value: 10 },
				{ ts: Date.parse("2025-01-01T01:00:00.000Z"), value: 20 },
				{ ts: Date.parse("2025-01-01T02:00:00.000Z"), value: 30 },
			],
		},
	};
}

function websocketPayload(server: NezhaServer, now: number) {
	return {
		now,
		servers: [server],
	};
}

function renderWithQuery(ui: React.ReactElement) {
	return render(
		<QueryClientProvider client={createTestQueryClient()}>
			{ui}
		</QueryClientProvider>,
	);
}

function seedWebSocketData(gpuNames = ["NVIDIA T4"]) {
	const baseNow = Date.parse("2025-01-01T00:00:20.000Z");
	const server = createServer({
		id: 7,
		name: "edge-chart-detail",
		host: {
			gpu: gpuNames,
		},
		state: {
			cpu: 45,
			disk_used: 180,
			gpu: gpuNames.map((_, index) => 33 + index),
			mem_used: 80,
			net_in_speed: 4 * 1024 ** 2,
			net_out_speed: 3 * 1024 ** 2,
			process_count: 77,
			swap_used: 25,
			tcp_conn_count: 18,
			udp_conn_count: 9,
		},
	});

	detailChartMocks.connected = true;
	detailChartMocks.lastData = websocketPayload(server, baseNow);
	detailChartMocks.messageHistory = [0, 1, 2].map((index) =>
		websocketPayload(
			createServer({
				id: 7,
				host: {
					gpu: gpuNames,
				},
				state: {
					cpu: 30 + index,
					disk_used: 100 + index * 10,
					gpu: gpuNames.map((_, gpuIndex) => 20 + index + gpuIndex),
					mem_used: 50 + index * 5,
					net_in_speed: (1 + index) * 1024 ** 2,
					net_out_speed: (2 + index) * 1024 ** 2,
					process_count: 60 + index,
					swap_used: 10 + index,
					tcp_conn_count: 10 + index,
					udp_conn_count: 5 + index,
				},
			}),
			baseNow - index * 1000,
		),
	);
}

describe("ServerDetailChart", () => {
	beforeEach(() => {
		detailChartMocks.connected = true;
		detailChartMocks.fetchLoginUser.mockReset();
		detailChartMocks.fetchServerMetrics.mockReset();
		detailChartMocks.fetchSetting.mockReset();
		detailChartMocks.lastData = null;
		detailChartMocks.messageHistory = [];
		detailChartMocks.fetchLoginUser.mockRejectedValue(new Error("anonymous"));
		detailChartMocks.fetchSetting.mockResolvedValue(settingResponse());
	});

	it("renders the loading grid without websocket data", () => {
		detailChartMocks.connected = false;

		const { container } = renderWithQuery(<ServerDetailChart server_id="7" />);

		const grid = container.querySelector(".grid");
		expect(grid).toHaveClass("grid-cols-1", "gap-3");
		expect(
			grid?.className
				.split(/\s+/)
				.filter((name) => name.includes("grid-cols-")),
		).toEqual(["grid-cols-1"]);
		expect(grid?.children).toHaveLength(6);
		for (const skeleton of Array.from(grid?.children ?? [])) {
			expect(skeleton).toHaveClass(
				"h-[312px]",
				"md:h-[412px]",
				"w-full",
				"min-w-0",
			);
		}
	});

	it.each([
		{ label: "without GPUs", gpuNames: [], chartCount: 6 },
		{ label: "with one GPU", gpuNames: ["NVIDIA T4"], chartCount: 7 },
		{
			label: "with multiple GPUs",
			gpuNames: ["NVIDIA T4", "NVIDIA A10"],
			chartCount: 8,
		},
	])("uses the same single-column large-chart layout $label", async ({
		gpuNames,
		chartCount,
	}) => {
		seedWebSocketData(gpuNames);

		const { container } = renderWithQuery(<ServerDetailChart server_id="7" />);
		await screen.findByText("serverDetailChart.realtime");

		const grid = container.querySelector(".server-charts");
		expect(grid).toHaveClass("grid-cols-1", "gap-3");
		expect(
			grid?.className
				.split(/\s+/)
				.filter((name) => name.includes("grid-cols-")),
		).toEqual(["grid-cols-1"]);
		expect(grid?.children).toHaveLength(chartCount);
		for (const card of Array.from(grid?.children ?? [])) {
			expect(card).toHaveClass("min-w-0");
		}

		const charts = container.querySelectorAll("[data-chart]");
		expect(charts).toHaveLength(chartCount);
		for (const chart of charts) {
			expect(chart).toHaveClass(
				"aspect-auto",
				"h-[260px]",
				"md:h-[360px]",
				"w-full",
				"min-w-0",
			);
		}
		for (const gpuName of gpuNames) {
			expect(screen.getByText(`GPU: ${gpuName}`)).toBeInTheDocument();
		}
		if (gpuNames.length === 0) {
			expect(screen.queryByText(/^GPU/)).not.toBeInTheDocument();
		}
	});

	it("renders realtime resource, network, connection, and GPU charts", async () => {
		const user = userEvent.setup();
		seedWebSocketData();

		renderWithQuery(<ServerDetailChart server_id="7" />);

		expect(
			await screen.findByText("serverDetailChart.realtime"),
		).toBeInTheDocument();
		expect(screen.getByText("serverDetailChart.period1d")).toBeInTheDocument();
		expect(screen.getByText("serverDetailChart.period7d")).toBeInTheDocument();
		expect(screen.getByText("CPU")).toBeInTheDocument();
		expect(screen.getByText("GPU: NVIDIA T4")).toBeInTheDocument();
		expect(screen.getByText("serverDetailChart.mem")).toBeInTheDocument();
		expect(screen.getByText("serverDetailChart.swap")).toBeInTheDocument();
		expect(screen.getByText("serverDetailChart.disk")).toBeInTheDocument();
		expect(screen.getByText("serverDetailChart.process")).toBeInTheDocument();
		expect(screen.getByText("serverDetailChart.upload")).toBeInTheDocument();
		expect(screen.getByText("serverDetailChart.download")).toBeInTheDocument();
		expect(screen.getByText("TCP")).toBeInTheDocument();
		expect(screen.getByText("UDP")).toBeInTheDocument();
		expect(screen.getAllByTestId("area-chart").length).toBeGreaterThan(0);
		expect(screen.getAllByTestId("line-chart").length).toBeGreaterThan(0);

		await user.click(screen.getByText("serverDetailChart.period7d"));

		expect(detailChartMocks.fetchServerMetrics).toHaveBeenCalled();
	});

	it("prevents historical periods when TSDB is disabled", async () => {
		const user = userEvent.setup();
		seedWebSocketData();
		detailChartMocks.fetchSetting.mockResolvedValue(settingResponse(false));

		renderWithQuery(<ServerDetailChart server_id="7" />);

		await screen.findByText("serverDetailChart.realtime");
		await user.click(screen.getByText("serverDetailChart.period1d"));

		expect(detailChartMocks.fetchServerMetrics).not.toHaveBeenCalled();
	});

	it("fetches every historical metric group for the selected period", async () => {
		const user = userEvent.setup();
		seedWebSocketData();
		Object.defineProperty(document, "cookie", {
			configurable: true,
			value: "session=1",
		});
		detailChartMocks.fetchLoginUser.mockResolvedValue(loginResponse());
		detailChartMocks.fetchServerMetrics.mockImplementation(
			(_serverId: number, metric: string) =>
				Promise.resolve(metricsResponse(metric)),
		);

		renderWithQuery(<ServerDetailChart server_id="7" />);

		await screen.findByText("serverDetailChart.realtime");
		await user.click(screen.getByText("serverDetailChart.period1d"));

		for (const metric of [
			"cpu",
			"gpu",
			"memory",
			"swap",
			"disk",
			"process_count",
			"net_out_speed",
			"net_in_speed",
			"tcp_conn",
			"udp_conn",
		]) {
			await waitFor(() => {
				expect(detailChartMocks.fetchServerMetrics).toHaveBeenCalledWith(
					7,
					metric,
					"1d",
				);
			});
		}
	});

	it("preserves enlarged containers while loading history and returning to realtime", async () => {
		const user = userEvent.setup();
		seedWebSocketData();
		const pendingMetrics: Array<() => void> = [];
		detailChartMocks.fetchServerMetrics.mockImplementation(
			(_serverId: number, metric: string) =>
				new Promise((resolve) => {
					pendingMetrics.push(() => resolve(metricsResponse(metric)));
				}),
		);
		const { container } = renderWithQuery(<ServerDetailChart server_id="7" />);

		await screen.findByText("serverDetailChart.realtime");
		await user.click(screen.getByText("serverDetailChart.period30d"));

		const charts = container.querySelectorAll("[data-chart]");
		expect(charts).toHaveLength(7);
		for (const chart of charts) {
			expect(chart).toHaveClass("h-[260px]", "md:h-[360px]");
			const placeholder = chart.querySelector(".h-full.w-full");
			expect(placeholder).toBeInTheDocument();
			expect(placeholder).toHaveStyle({ width: "100%", height: "100%" });
		}

		await act(async () => {
			for (const resolveMetric of pendingMetrics) {
				resolveMetric();
			}
		});
		await waitFor(() => {
			expect(screen.getAllByTestId("responsive-chart")).toHaveLength(7);
		});
		expect(detailChartMocks.fetchServerMetrics).toHaveBeenCalledWith(
			7,
			"cpu",
			"30d",
		);

		detailChartMocks.fetchServerMetrics.mockClear();
		await user.click(screen.getByText("serverDetailChart.realtime"));
		expect(screen.getAllByTestId("responsive-chart")).toHaveLength(7);
		expect(detailChartMocks.fetchServerMetrics).not.toHaveBeenCalled();
		for (const chart of container.querySelectorAll("[data-chart]")) {
			expect(chart).toHaveClass("h-[260px]", "md:h-[360px]");
		}
	});
});
