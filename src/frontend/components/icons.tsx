// Íconos del sistema: Phosphor en estilo "dos tonos" (duotone), con los mismos nombres que se usaban antes.
// Cada pantalla los usa igual: <Wrench size={16} strokeWidth={STROKE} aria-hidden="true" />.
// size, color, className y style se respetan; strokeWidth se ignora (Phosphor no usa trazo).
// La versión /ssr funciona igual en pantallas del servidor y del navegador.
import { forwardRef, type ComponentType, type SVGProps } from "react";
import type { Icon as PhIcon } from "@phosphor-icons/react";
import {
  AppWindow as PhAppWindow, Archive as PhArchive, ArrowCounterClockwise as PhArrowCounterClockwise, ArrowDown as PhArrowDown, ArrowLeft as PhArrowLeft, ArrowUUpLeft as PhArrowUUpLeft, ArrowUp as PhArrowUp,
  ArrowsClockwise as PhArrowsClockwise, ArrowsDownUp as PhArrowsDownUp, ArrowsLeftRight as PhArrowsLeftRight, ArrowsOut as PhArrowsOut, Backpack as PhBackpack, BatteryFull as PhBatteryFull,
  Bell as PhBell, BellRinging as PhBellRinging, BookmarkSimple as PhBookmarkSimple, Briefcase as PhBriefcase, Buildings as PhBuildings, Calendar as PhCalendar,
  CalendarDots as PhCalendarDots, Camera as PhCamera, CaretLeft as PhCaretLeft, CaretRight as PhCaretRight, ChartBar as PhChartBar, ChatCircle as PhChatCircle, ChatText as PhChatText, CheckCircle as PhCheckCircle,
  CheckSquare as PhCheckSquare, Circuitry as PhCircuitry, ClipboardText as PhClipboardText, Clock as PhClock, Columns as PhColumns, ClockCounterClockwise as PhClockCounterClockwise, Cloud as PhCloud,
  Copy as PhCopy, Cpu as PhCpu, Cube as PhCube, DeviceMobile as PhDeviceMobile, DeviceTablet as PhDeviceTablet, Disc as PhDisc,
  DownloadSimple as PhDownloadSimple, Drop as PhDrop, Envelope as PhEnvelope, Eye as PhEye, EyeSlash as PhEyeSlash, FilePlus as PhFilePlus,
  FileText as PhFileText, FileXls as PhFileXls, Files as PhFiles, Flag as PhFlag, FolderOpen as PhFolderOpen, GameController as PhGameController,
  Gear as PhGear, GearSix as PhGearSix, Globe as PhGlobe, Hammer as PhHammer, Hand as PhHand, HandCoins as PhHandCoins,
  Handshake as PhHandshake, HardDrive as PhHardDrive, HardDrives as PhHardDrives, Hourglass as PhHourglass, IdentificationCard as PhIdentificationCard, Image as PhImage,
  ImageSquare as PhImageSquare, Images as PhImages, Joystick as PhJoystick, Key as PhKey, Keyboard as PhKeyboard, Laptop as PhLaptop,
  Lightbulb as PhLightbulb, Lightning as PhLightning, LinkBreak as PhLinkBreak, LinkSimple as PhLinkSimple, ListChecks as PhListChecks, Lock as PhLock,
  MagnifyingGlass as PhMagnifyingGlass, MagnifyingGlassMinus as PhMagnifyingGlassMinus, MapPin as PhMapPin, MapPinArea as PhMapPinArea, Medal as PhMedal, Megaphone as PhMegaphone,
  Memory as PhMemory, Money as PhMoney, Monitor as PhMonitor, NavigationArrow as PhNavigationArrow, NotePencil as PhNotePencil, Nut as PhNut,
  Package as PhPackage, PaintBrush as PhPaintBrush, Palette as PhPalette, PaperPlaneTilt as PhPaperPlaneTilt, Pause as PhPause, PencilLine as PhPencilLine,
  PencilSimple as PhPencilSimple, Phone as PhPhone, Plug as PhPlug, Plugs as PhPlugs, Plus as PhPlus, Printer as PhPrinter,
  Prohibit as PhProhibit, Pulse as PhPulse, PushPin as PhPushPin, QrCode as PhQrCode, Radio as PhRadio, Receipt as PhReceipt,
  Robot as PhRobot, Ruler as PhRuler, Scales as PhScales, Scan as PhScan, Scissors as PhScissors, SealCheck as PhSealCheck,
  Shapes as PhShapes, Shield as PhShield, ShieldCheck as PhShieldCheck, ShoppingBag as PhShoppingBag, ShoppingCart as PhShoppingCart, SignOut as PhSignOut,
  Square as PhSquare, SquaresFour as PhSquaresFour, Stack as PhStack, Star as PhStar, Stethoscope as PhStethoscope, Storefront as PhStorefront,
  Tag as PhTag, Target as PhTarget, Thermometer as PhThermometer, Trash as PhTrash, Tray as PhTray, TrendUp as PhTrendUp,
  Trophy as PhTrophy, UploadSimple as PhUploadSimple, User as PhUser, UserGear as PhUserGear, Users as PhUsers, Wallet as PhWallet,
  Warning as PhWarning, Watch as PhWatch, Wrench as PhWrench, X as PhX, XCircle as PhXCircle,
} from "@phosphor-icons/react/dist/ssr";

export type IconProps = Omit<SVGProps<SVGSVGElement>, "ref" | "color"> & { size?: number | string; color?: string; strokeWidth?: number | string };
export type AppIcon = ComponentType<IconProps>;

function duo(P: PhIcon, name: string): AppIcon {
  const C = forwardRef<SVGSVGElement, IconProps>(function DuoIcon({ strokeWidth: _stroke, className, ...rest }, ref) {
    return <P ref={ref} weight="duotone" className={className ? `ui-ic ${className}` : "ui-ic"} {...rest} />;
  });
  C.displayName = name;
  return C;
}

export const Activity = duo(PhPulse, "Activity");
export const AppWindow = duo(PhAppWindow, "AppWindow");
export const ArrowDown = duo(PhArrowDown, "ArrowDown");
export const ArrowDownUp = duo(PhArrowsDownUp, "ArrowDownUp");
export const ArrowLeft = duo(PhArrowLeft, "ArrowLeft");
export const ArrowLeftRight = duo(PhArrowsLeftRight, "ArrowLeftRight");
export const ArrowRightLeft = duo(PhArrowsLeftRight, "ArrowRightLeft");
export const ArrowUp = duo(PhArrowUp, "ArrowUp");
export const Award = duo(PhMedal, "Award");
export const Backpack = duo(PhBackpack, "Backpack");
export const BadgeCheck = duo(PhSealCheck, "BadgeCheck");
export const Ban = duo(PhProhibit, "Ban");
export const Banknote = duo(PhMoney, "Banknote");
export const BatteryFull = duo(PhBatteryFull, "BatteryFull");
export const Bell = duo(PhBell, "Bell");
export const BellRing = duo(PhBellRinging, "BellRing");
export const Bookmark = duo(PhBookmarkSimple, "Bookmark");
export const Bot = duo(PhRobot, "Bot");
export const Box = duo(PhCube, "Box");
export const Boxes = duo(PhStack, "Boxes");
export const Briefcase = duo(PhBriefcase, "Briefcase");
export const Brush = duo(PhPaintBrush, "Brush");
export const Building2 = duo(PhBuildings, "Building2");
export const Cable = duo(PhPlugs, "Cable");
export const CalendarDays = duo(PhCalendarDots, "CalendarDays");
export const CalendarRange = duo(PhCalendar, "CalendarRange");
export const Camera = duo(PhCamera, "Camera");
export const ChartColumn = duo(PhChartBar, "ChartColumn");
export const CircleCheck = duo(PhCheckCircle, "CircleCheck");
export const ChevronLeft = duo(PhCaretLeft, "ChevronLeft");
export const ChevronRight = duo(PhCaretRight, "ChevronRight");
export const CircleX = duo(PhXCircle, "CircleX");
export const Columns2 = duo(PhColumns, "Columns2");
export const CircuitBoard = duo(PhCircuitry, "CircuitBoard");
export const ClipboardList = duo(PhClipboardText, "ClipboardList");
export const Clock = duo(PhClock, "Clock");
export const Cloud = duo(PhCloud, "Cloud");
export const Cog = duo(PhGear, "Cog");
export const Copy = duo(PhCopy, "Copy");
export const Cpu = duo(PhCpu, "Cpu");
export const Disc3 = duo(PhDisc, "Disc3");
export const Download = duo(PhDownloadSimple, "Download");
export const Droplet = duo(PhDrop, "Droplet");
export const Eye = duo(PhEye, "Eye");
export const EyeOff = duo(PhEyeSlash, "EyeOff");
export const FilePlus2 = duo(PhFilePlus, "FilePlus2");
export const FileSpreadsheet = duo(PhFileXls, "FileSpreadsheet");
export const FileText = duo(PhFileText, "FileText");
export const Files = duo(PhFiles, "Files");
export const Flag = duo(PhFlag, "Flag");
export const FolderOpen = duo(PhFolderOpen, "FolderOpen");
export const Gamepad2 = duo(PhGameController, "Gamepad2");
export const Globe = duo(PhGlobe, "Globe");
export const Hammer = duo(PhHammer, "Hammer");
export const Hand = duo(PhHand, "Hand");
export const HandCoins = duo(PhHandCoins, "HandCoins");
export const Handshake = duo(PhHandshake, "Handshake");
export const HardDrive = duo(PhHardDrive, "HardDrive");
export const History = duo(PhClockCounterClockwise, "History");
export const Hourglass = duo(PhHourglass, "Hourglass");
export const IdCard = duo(PhIdentificationCard, "IdCard");
export const Image = duo(PhImage, "Image");
export const ImagePlus = duo(PhImageSquare, "ImagePlus");
export const Images = duo(PhImages, "Images");
export const Inbox = duo(PhTray, "Inbox");
export const Joystick = duo(PhJoystick, "Joystick");
export const KeyRound = duo(PhKey, "KeyRound");
export const Keyboard = duo(PhKeyboard, "Keyboard");
export const Laptop = duo(PhLaptop, "Laptop");
export const Layers = duo(PhStack, "Layers");
export const LayoutDashboard = duo(PhSquaresFour, "LayoutDashboard");
export const Lightbulb = duo(PhLightbulb, "Lightbulb");
export const Link2 = duo(PhLinkSimple, "Link2");
export const Link2Off = duo(PhLinkBreak, "Link2Off");
export const ListChecks = duo(PhListChecks, "ListChecks");
export const Lock = duo(PhLock, "Lock");
export const LogOut = duo(PhSignOut, "LogOut");
export const Mail = duo(PhEnvelope, "Mail");
export const MapPin = duo(PhMapPin, "MapPin");
export const MapPinned = duo(PhMapPinArea, "MapPinned");
export const Maximize2 = duo(PhArrowsOut, "Maximize2");
export const Megaphone = duo(PhMegaphone, "Megaphone");
export const MemoryStick = duo(PhMemory, "MemoryStick");
export const MessageCircle = duo(PhChatCircle, "MessageCircle");
export const MessageSquare = duo(PhChatText, "MessageSquare");
export const Monitor = duo(PhMonitor, "Monitor");
export const Navigation = duo(PhNavigationArrow, "Navigation");
export const Nut = duo(PhNut, "Nut");
export const Package = duo(PhPackage, "Package");
export const PackageOpen = duo(PhArchive, "PackageOpen");
export const Palette = duo(PhPalette, "Palette");
export const Pause = duo(PhPause, "Pause");
export const PenLine = duo(PhPencilLine, "PenLine");
export const Pencil = duo(PhPencilSimple, "Pencil");
export const Phone = duo(PhPhone, "Phone");
export const Pin = duo(PhPushPin, "Pin");
export const Plug = duo(PhPlug, "Plug");
export const Plus = duo(PhPlus, "Plus");
export const Printer = duo(PhPrinter, "Printer");
export const QrCode = duo(PhQrCode, "QrCode");
export const Radio = duo(PhRadio, "Radio");
export const Receipt = duo(PhReceipt, "Receipt");
export const RefreshCw = duo(PhArrowsClockwise, "RefreshCw");
export const RotateCcw = duo(PhArrowCounterClockwise, "RotateCcw");
export const Ruler = duo(PhRuler, "Ruler");
export const Scale = duo(PhScales, "Scale");
export const ScanLine = duo(PhScan, "ScanLine");
export const Scissors = duo(PhScissors, "Scissors");
export const Search = duo(PhMagnifyingGlass, "Search");
export const SearchX = duo(PhMagnifyingGlassMinus, "SearchX");
export const Send = duo(PhPaperPlaneTilt, "Send");
export const Server = duo(PhHardDrives, "Server");
export const Settings = duo(PhGearSix, "Settings");
export const Shapes = duo(PhShapes, "Shapes");
export const Shield = duo(PhShield, "Shield");
export const ShieldCheck = duo(PhShieldCheck, "ShieldCheck");
export const ShoppingBag = duo(PhShoppingBag, "ShoppingBag");
export const ShoppingCart = duo(PhShoppingCart, "ShoppingCart");
export const Smartphone = duo(PhDeviceMobile, "Smartphone");
export const Square = duo(PhSquare, "Square");
export const SquareCheck = duo(PhCheckSquare, "SquareCheck");
export const SquarePen = duo(PhNotePencil, "SquarePen");
export const Star = duo(PhStar, "Star");
export const Stethoscope = duo(PhStethoscope, "Stethoscope");
export const Store = duo(PhStorefront, "Store");
export const Tablet = duo(PhDeviceTablet, "Tablet");
export const Tag = duo(PhTag, "Tag");
export const Target = duo(PhTarget, "Target");
export const Thermometer = duo(PhThermometer, "Thermometer");
export const Trash2 = duo(PhTrash, "Trash2");
export const TrendingUp = duo(PhTrendUp, "TrendingUp");
export const TriangleAlert = duo(PhWarning, "TriangleAlert");
export const Trophy = duo(PhTrophy, "Trophy");
export const Undo2 = duo(PhArrowUUpLeft, "Undo2");
export const Upload = duo(PhUploadSimple, "Upload");
export const User = duo(PhUser, "User");
export const UserCog = duo(PhUserGear, "UserCog");
export const Users = duo(PhUsers, "Users");
export const Wallet = duo(PhWallet, "Wallet");
export const Watch = duo(PhWatch, "Watch");
export const Wrench = duo(PhWrench, "Wrench");
export const X = duo(PhX, "X");
export const Zap = duo(PhLightning, "Zap");
