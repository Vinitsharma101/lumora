"use client";

import { Separator } from "@/components/ui/separator";
import { type Tab, useAssetsPanelStore } from "@/stores/assets-panel-store";
import { TabBar } from "./tabbar";
import { Captions } from "./views/captions";
import { MediaView } from "./views/assets";
import { SettingsView } from "./views/settings";
import { SoundsView } from "./views/sounds";
import { StickersView } from "./views/stickers";
import { TextView } from "./views/text";
import { EffectsView } from "./views/effects";
import { TransitionsView } from "./views/transitions";
import { FiltersView } from "./views/filters";
import { AdjustmentView } from "./views/adjustment";
import { CollaborateView } from "./views/collaborate";
import { StockMediaView } from "./views/stock-media";

export function AssetsPanel() {
	const { activeTab } = useAssetsPanelStore();

	const viewMap: Record<Tab, React.ReactNode> = {
		media: <MediaView />,
		sounds: <SoundsView />,
		stock: <StockMediaView />,
		text: <TextView />,
		stickers: <StickersView />,
		effects: <EffectsView />,
		transitions: <TransitionsView />,
		captions: <Captions />,
		filters: <FiltersView />,
		adjustment: <AdjustmentView />,
		collaborate: <CollaborateView />,
		settings: <SettingsView />,
	};

	return (
		<div className="panel bg-background flex h-full rounded-sm border overflow-hidden">
			<TabBar />
			<Separator orientation="vertical" />
			<div className="flex-1 overflow-hidden">{viewMap[activeTab]}</div>
		</div>
	);
}
