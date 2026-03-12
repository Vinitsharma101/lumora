/**
 * API communication test utility
 * Run this in the browser console to verify frontend-backend communication
 * 
 * Example:
 * import { testAPIConnection } from '@/utils/api-test'
 * await testAPIConnection()
 */

import { apiFetch } from "@/lib/api-client";

interface TestResult {
	name: string;
	passed: boolean;
	message: string;
	responseTime?: number;
}

export async function testAPIConnection(): Promise<void> {
	console.log("🔍 Starting API Connection Tests...\n");

	const results: TestResult[] = [];

	// Test 1: Health Check
	try {
		const start = performance.now();
		const response = await apiFetch("/api/health");
		const time = performance.now() - start;

		if (response.ok) {
			const data = await response.json();
			results.push({
				name: "Health Check",
				passed: true,
				message: `✅ Backend is healthy (${time.toFixed(0)}ms)`,
				responseTime: time,
			});
		} else {
			results.push({
				name: "Health Check",
				passed: false,
				message: `❌ Health check failed: ${response.status} ${response.statusText}`,
			});
		}
	} catch (error) {
		results.push({
			name: "Health Check",
			passed: false,
			message: `❌ Connection failed: ${error instanceof Error ? error.message : String(error)}`,
		});
	}

	// Test 2: CORS Headers
	try {
		const response = await fetch(
			`${process.env.NEXT_PUBLIC_API_URL}/api/health`,
			{ mode: "cors" },
		);
		const corsHeader = response.headers.get("access-control-allow-origin");

		if (corsHeader) {
			results.push({
				name: "CORS Configuration",
				passed: true,
				message: `✅ CORS enabled for: ${corsHeader}`,
			});
		} else {
			results.push({
				name: "CORS Configuration",
				passed: false,
				message: "❌ CORS headers not found",
			});
		}
	} catch (error) {
		results.push({
			name: "CORS Configuration",
			passed: false,
			message: `❌ CORS test failed: ${error instanceof Error ? error.message : String(error)}`,
		});
	}

	// Test 3: API URL Configuration
	const apiUrl = process.env.NEXT_PUBLIC_API_URL;
	if (apiUrl) {
		results.push({
			name: "API URL Configuration",
			passed: true,
			message: `✅ API URL is configured: ${apiUrl}`,
		});
	} else {
		results.push({
			name: "API URL Configuration",
			passed: false,
			message: "❌ NEXT_PUBLIC_API_URL is not configured",
		});
	}

	// Test 4: Auth Token Storage
	try {
		const token = localStorage.getItem("grace_studio_token");
		results.push({
			name: "Auth Token Storage",
			passed: !token, // Passed if no token (as expected for new session)
			message: token
				? `ℹ️ Auth token found (logged in)`
				: `ℹ️ No auth token (not logged in)`,
		});
	} catch (error) {
		results.push({
			name: "Auth Token Storage",
			passed: false,
			message: `❌ localStorage access failed: ${error instanceof Error ? error.message : String(error)}`,
		});
	}

	// Print results
	console.log("📊 Test Results:\n");
	results.forEach((result) => {
		const status = result.passed ? "✅" : "❌";
		console.log(`${status} ${result.name}`);
		console.log(`   ${result.message}\n`);
	});

	const passed = results.filter((r) => r.passed).length;
	const total = results.length;

	console.log(`\n📈 Summary: ${passed}/${total} tests passed`);

	if (passed === total) {
		console.log(
			"✨ API communication is properly configured and working!",
		);
	} else {
		console.log(
			"⚠️  Some tests failed. Check your configuration:",
			{
				apiUrl: process.env.NEXT_PUBLIC_API_URL,
				nodeEnv: process.env.NODE_ENV,
			},
		);
	}
}

/**
 * Helper to make a test API call
 */
export async function makeTestAPICall(path: string): Promise<unknown> {
	try {
		console.log(`📤 Making request to: ${path}`);
		const response = await apiFetch(path);

		if (!response.ok) {
			throw new Error(
				`HTTP ${response.status}: ${response.statusText}`,
			);
		}

		const data = await response.json();
		console.log(`📥 Response:`, data);
		return data;
	} catch (error) {
		console.error(`❌ Request failed:`, error);
		throw error;
	}
}
