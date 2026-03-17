/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Alerts from './pages/Alerts';
import BrokerManager from './pages/BrokerManager';
import ChartBoard from './pages/ChartBoard';
import Compare from './pages/Compare';
import Dashboard from './pages/Dashboard';
import MarketWatch from './pages/MarketWatch';
import OpportunityRadar from './pages/OpportunityRadar';
import OptionsAnalysis from './pages/OptionsAnalysis';
import Portfolio from './pages/Portfolio';
import Screener from './pages/Screener';
import SectorHeatmap from './pages/SectorHeatmap';
import StockAnalysis from './pages/StockAnalysis';
import StockNews from './pages/StockNews';
import TradingBot from './pages/TradingBot';
import VirtualPortfolio from './pages/VirtualPortfolio';
import Watchlist from './pages/Watchlist';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Alerts": Alerts,
    "BrokerManager": BrokerManager,
    "ChartBoard": ChartBoard,
    "Compare": Compare,
    "Dashboard": Dashboard,
    "MarketWatch": MarketWatch,
    "OpportunityRadar": OpportunityRadar,
    "OptionsAnalysis": OptionsAnalysis,
    "Portfolio": Portfolio,
    "Screener": Screener,
    "SectorHeatmap": SectorHeatmap,
    "StockAnalysis": StockAnalysis,
    "StockNews": StockNews,
    "TradingBot": TradingBot,
    "VirtualPortfolio": VirtualPortfolio,
    "Watchlist": Watchlist,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};