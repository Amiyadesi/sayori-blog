export interface TimetableCourse {
	id: string;
	title: string;
	titleEn: string;
	day: number;
	periods: [number, number];
	weeks: [number, number];
	room: string;
	roomEn: string;
}

// 安吉校区作息与第 1 周日期：https://www.zust.edu.cn/fw/xl.htm
export const semester = {
	firstMonday: "2026-09-07",
	lastDate: "2027-01-17",
	weeks: 19,
	timeZone: "Asia/Shanghai",
};

export const periods = [
	{ number: 1, start: "08:40", end: "09:25" },
	{ number: 2, start: "09:30", end: "10:15" },
	{ number: 3, start: "10:25", end: "11:10" },
	{ number: 4, start: "11:15", end: "12:00" },
	// 第 5 节为午休，不排课
	{ number: 6, start: "13:30", end: "14:15" },
	{ number: 7, start: "14:20", end: "15:05" },
	{ number: 8, start: "15:15", end: "16:00" },
	{ number: 9, start: "16:05", end: "16:50" },
	{ number: 10, start: "18:30", end: "19:15" },
	{ number: 11, start: "19:20", end: "20:05" },
	{ number: 12, start: "20:10", end: "20:55" },
];

// 只转录课程信息，不保存原课表中的姓名、学号和教师姓名
export const courses: TimetableCourse[] = [
	{
		id: "english",
		title: "工程师英语1",
		titleEn: "English for Engineers 1",
		day: 1,
		periods: [1, 2],
		weeks: [1, 16],
		room: "崇德楼 201",
		roomEn: "Chongde 201",
	},
	{
		id: "data-mon",
		title: "数据结构",
		titleEn: "Data Structures",
		day: 1,
		periods: [3, 4],
		weeks: [1, 16],
		room: "明德楼 210",
		roomEn: "Mingde 210",
	},
	{
		id: "interaction",
		title: "智能交互设计",
		titleEn: "Intelligent Interaction Design",
		day: 1,
		periods: [10, 12],
		weeks: [1, 16],
		room: "中德楼 B312",
		roomEn: "Sino-German Building B312",
	},
	{
		id: "data-tue",
		title: "数据结构",
		titleEn: "Data Structures",
		day: 2,
		periods: [1, 2],
		weeks: [1, 16],
		room: "明德楼 210",
		roomEn: "Mingde 210",
	},
	{
		id: "probability",
		title: "概率论与数理统计B",
		titleEn: "Probability and Mathematical Statistics B",
		day: 2,
		periods: [3, 4],
		weeks: [1, 16],
		room: "崇德楼 311",
		roomEn: "Chongde 311",
	},
	{
		id: "physics-lab",
		title: "大学物理实验B",
		titleEn: "Physics Lab B",
		day: 2,
		periods: [6, 8],
		weeks: [2, 12],
		room: "基础实验中心 345物理",
		roomEn: "Basic Experiment Center, Physics Lab 345",
	},
	{
		id: "pe",
		title: "体育3",
		titleEn: "Physical Education 3",
		day: 2,
		periods: [10, 11],
		weeks: [1, 16],
		room: "安吉体育馆 109",
		roomEn: "Anji Gymnasium 109",
	},
	{
		id: "computer",
		title: "计算机组成与系统结构",
		titleEn: "Computer Organization and Architecture",
		day: 3,
		periods: [1, 3],
		weeks: [1, 16],
		room: "中德楼 B212",
		roomEn: "Sino-German Building B212",
	},
	{
		id: "career",
		title: "大学生职业发展与就业指导1",
		titleEn: "Career Development and Employment Guidance 1",
		day: 3,
		periods: [6, 7],
		weeks: [1, 4],
		room: "明德楼 210",
		roomEn: "Mingde 210",
	},
	{
		id: "policy",
		title: "形势与政策3",
		titleEn: "Current Affairs and Policy 3",
		day: 3,
		periods: [6, 7],
		weeks: [13, 16],
		room: "厚德楼 311",
		roomEn: "Houde 311",
	},
	{
		id: "product",
		title: "产品开发与项目管理",
		titleEn: "Product Development and Project Management",
		day: 3,
		periods: [10, 11],
		weeks: [1, 16],
		room: "崇德楼 311",
		roomEn: "Chongde 311",
	},
	{
		id: "physics",
		title: "大学物理B2",
		titleEn: "University Physics B2",
		day: 4,
		periods: [1, 2],
		weeks: [1, 16],
		room: "崇德楼 311",
		roomEn: "Chongde 311",
	},
	{
		id: "html",
		title: "HTML5程序设计",
		titleEn: "HTML5 Programming",
		day: 4,
		periods: [10, 12],
		weeks: [1, 16],
		room: "明德楼 111",
		roomEn: "Mingde 111",
	},
	{
		id: "marxism",
		title: "马克思主义基本原理",
		titleEn: "Basic Principles of Marxism",
		day: 5,
		periods: [1, 3],
		weeks: [1, 16],
		room: "崇德楼 210",
		roomEn: "Chongde 210",
	},
];

export const courseProject = {
	week: 17,
	title: "智能交互设计课程设计",
	titleEn: "Intelligent Interaction Design Course Project",
};

export const holidays = [
	{
		start: "2026-09-25",
		end: "2026-09-27",
		title: "中秋节",
		titleEn: "Mid-Autumn Festival",
	},
	{
		start: "2026-10-01",
		end: "2026-10-07",
		title: "国庆节",
		titleEn: "National Day holiday",
	},
	{
		start: "2027-01-01",
		end: "2027-01-01",
		title: "元旦",
		titleEn: "New Year's Day",
	},
];

// 补课按被补日期的星期和教学周计算，而不是补课当天的周次
// https://shxy.zust.edu.cn/info/1082/7909.htm
export const makeupDays: Record<string, string> = {
	"2026-09-20": "2026-10-06",
	"2026-10-10": "2026-10-07",
};
