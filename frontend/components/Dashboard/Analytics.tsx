'use client';

import { Card, CardBody, CardHeader, Button } from "@heroui/react";
import { Activity, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Chart data
const chartData = [
  { name: 'Mon', executions: 4000, errors: 240 },
  { name: 'Tue', executions: 3000, errors: 139 },
  { name: 'Wed', executions: 2000, errors: 980 },
  { name: 'Thu', executions: 2780, errors: 390 },
  { name: 'Fri', executions: 1890, errors: 480 },
  { name: 'Sat', executions: 2390, errors: 380 },
  { name: 'Sun', executions: 3490, errors: 430 },
];

export function ActivityChart() {
  return (
    <Card className="h-[300px] border-none bg-black/20 backdrop-blur-md">
      <CardHeader className="flex justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Activity size={18} className="text-blue-500" /> System Activity
          </h3>
          <p className="text-xs text-default-500">Executions over last 7 days</p>
        </div>
        <Button size="sm" variant="flat" isIconOnly><ArrowUpRight size={16} /></Button>
      </CardHeader>
      <CardBody>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorExec" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorErr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
            <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#18181b', borderColor: '#333', borderRadius: '8px' }}
              itemStyle={{ color: '#fff' }}
            />
            <Area type="monotone" dataKey="executions" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorExec)" />
            <Area type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorErr)" />
          </AreaChart>
        </ResponsiveContainer>
      </CardBody>
    </Card>
  );
}

export function AnimatedStat({ label, value, icon: Icon, color }: any) {
  return (
    <Card className="border-none bg-gradient-to-br from-white/5 to-white/0">
      <CardBody className="flex flex-row items-center gap-4 p-6">
        <div className={`p-3 rounded-xl bg-${color}-500/20 text-${color}-500`}>
          <Icon size={24} />
        </div>
        <div>
          <p className="text-sm text-default-500">{label}</p>
          <motion.h4 
            className="text-2xl font-bold"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {value}
          </motion.h4>
        </div>
      </CardBody>
    </Card>
  );
}
