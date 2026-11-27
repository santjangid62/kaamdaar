import 'package:flutter/material.dart';
import 'services/admin_api.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';
void main()=>runApp(const SuperAdminApp());
class SuperAdminApp extends StatefulWidget{const SuperAdminApp({super.key});@override State<SuperAdminApp> createState()=>_SuperAdminAppState();}
class _SuperAdminAppState extends State<SuperAdminApp>{
 bool? signedIn;
 @override void initState(){super.initState();_check();}
 Future<void> _check()async{final ok=await AdminApi.hasToken();if(mounted)setState(()=>signedIn=ok);}
 @override Widget build(BuildContext context)=>MaterialApp(title:'Kaamdaar Super Admin',debugShowCheckedModeBanner:false,theme:ThemeData(useMaterial3:true,colorScheme:ColorScheme.fromSeed(seedColor:const Color(0xFFFF7A00)),scaffoldBackgroundColor:const Color(0xFFF3F6FB),appBarTheme:const AppBarTheme(backgroundColor:Color(0xFF0B2240),foregroundColor:Colors.white)),home:signedIn==null?const Scaffold(body:Center(child:CircularProgressIndicator())):signedIn!?DashboardScreen(onLogout:()async{await AdminApi.logout();if(mounted)setState(()=>signedIn=false);}):LoginScreen(onLogin:()=>setState(()=>signedIn=true)));
}